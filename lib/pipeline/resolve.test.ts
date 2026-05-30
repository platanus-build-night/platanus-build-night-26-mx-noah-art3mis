import { describe, it, expect, vi } from "vitest";
import { rationaleFor, dateWindow, resolveQuestion } from "./resolve";
import type { ClaimItem, EvidenceItem, QuestionItem, Stance } from "../graph-types";
import type { RawEvidence } from "../exa";
import type { ToolLoopOpts } from "../anthropic";
import type { PipelineDeps } from "./deps";

function claim(over: Partial<ClaimItem> = {}): ClaimItem {
  return { id: "c1", text: "a claim", checkable: true, verdict: null, ...over };
}

let evId = 0;
function evidence(
  stance: Stance,
  domain: string,
  reliability: EvidenceItem["reliability"] = "high",
  sourceType: EvidenceItem["sourceType"] = "primary",
): EvidenceItem {
  return {
    id: `e${evId++}`,
    questionId: "q1",
    title: "t",
    url: `https://${domain}/x`,
    domain,
    passage: "p",
    stance,
    reliability,
    sourceType,
    stanceConfidence: 0.9,
  };
}

describe("rationaleFor", () => {
  it("explains an unckeckable claim by its media-provenance limit, ignoring verdict", () => {
    const text = rationaleFor(claim({ checkable: false }), "nei", []);
    expect(text).toMatch(/imagery or media provenance/i);
  });

  it("explains an opinion/non-checkworthy claim as not a checkable assertion", () => {
    const text = rationaleFor(claim({ checkworthy: false }), "nei", []);
    expect(text).toMatch(/subjective or opinion/i);
  });

  it("explains nei with no evidence by saying no sources answered the questions", () => {
    expect(rationaleFor(claim(), "nei", [])).toMatch(/no primary sources answered/i);
  });

  it("explains nei with weak evidence by naming the sources that missed the bar", () => {
    // Low-reliability sources were found but none could move the verdict.
    const ev = [evidence("supports", "blog.example", "low"), evidence("contextualizes", "aggregator.test", "low")];
    const text = rationaleFor(claim(), "nei", ev);
    expect(text).toMatch(/found 2 sources/i);
    expect(text).toContain("blog.example");
    expect(text).toMatch(/none cleared the reliability/i);
  });

  it("names the supporting domains for a supported verdict and flags a primary source", () => {
    const ev = [evidence("supports", "bbc.com"), evidence("supports", "reuters.com")];
    expect(rationaleFor(claim(), "supported", ev)).toBe(
      "Supported by bbc.com and reuters.com — incl. a primary source.",
    );
  });

  it("flags re-reporting when no deciding source is a primary", () => {
    const ev = [evidence("supports", "bbc.com", "high", "secondary")];
    expect(rationaleFor(claim(), "supported", ev)).toBe(
      "Supported by bbc.com — re-reporting only, no originating source located.",
    );
  });

  it("uses only refuting domains when composing a refuted rationale", () => {
    const ev = [evidence("supports", "blog.example"), evidence("refutes", "proceso.com.mx")];
    const text = rationaleFor(claim(), "refuted", ev);
    expect(text).toContain("proceso.com.mx");
    // The deciding evidence for a refutation is the refuting source, not the stray support.
    expect(text).not.toContain("blog.example");
  });

  it("deduplicates repeated domains in the rationale", () => {
    const ev = [evidence("supports", "bbc.com"), evidence("supports", "bbc.com")];
    expect(rationaleFor(claim(), "supported", ev)).toBe("Supported by bbc.com — incl. a primary source.");
  });

  it("summarizes three-plus domains as 'a, b and others'", () => {
    const ev = [
      evidence("supports", "a.com"),
      evidence("supports", "b.com"),
      evidence("supports", "c.com"),
    ];
    expect(rationaleFor(claim(), "supported", ev)).toBe(
      "Supported by a.com, b.com and others — incl. a primary source.",
    );
  });

  it("considers both stances as deciding for a conflicting verdict", () => {
    const ev = [evidence("supports", "bbc.com"), evidence("refutes", "cnn.com")];
    const text = rationaleFor(claim(), "conflicting", ev);
    expect(text).toContain("bbc.com");
    expect(text).toContain("cnn.com");
    expect(text).toMatch(/conflict/i);
  });

  it("falls back to a generic phrase when the deciding set has no domains", () => {
    // supported verdict but no supporting evidence present → no domains, no primary to flag.
    const text = rationaleFor(claim(), "supported", [evidence("refutes", "x.com")]);
    expect(text).toBe("Supported by the retrieved sources — re-reporting only, no originating source located.");
  });
});

describe("dateWindow", () => {
  it("returns undefined when no date is known (current open-ended behavior)", () => {
    expect(dateWindow(undefined)).toBeUndefined();
  });

  it("returns undefined for an unparseable date rather than a bogus window", () => {
    expect(dateWindow("not-a-date")).toBeUndefined();
  });

  it("centers a window 30 days before and 14 days after the event date", () => {
    expect(dateWindow("2026-02-22")).toEqual({
      startPublishedDate: "2026-01-23",
      endPublishedDate: "2026-03-08",
    });
  });
});

describe("resolveQuestion (agentic gather loop)", () => {
  const question: QuestionItem = { id: "c1-q1", claimId: "c1", text: "did X happen?", status: "searching" };

  function rawSource(domain: string): RawEvidence {
    return { title: "t", url: `https://${domain}/x`, domain, passage: "p" };
  }

  // askWithTools is the model: we script which queries it issues via opts.onTool.
  function fakeModel(queries: string[]) {
    return vi.fn(async (_prompt: string, opts: ToolLoopOpts) => {
      for (const q of queries) await opts.onTool("search_evidence", { query: q });
      return { text: "done", toolCalls: [], steps: queries.length };
    });
  }

  function deps(over: Partial<PipelineDeps> = {}, queries = ["model query 1"]): PipelineDeps {
    return {
      ask: {
        askText: vi.fn().mockResolvedValue("A neutral hypothetical report."),
        askJSON: vi.fn().mockResolvedValue([]),
        askWithTools: fakeModel(queries),
      },
      search: vi.fn().mockResolvedValue([]),
      maxClaims: 5,
      maxQuestions: 2,
      ...over,
    };
  }

  it("seeds the loop with a HyDE-expanded query (question text + hypothetical)", async () => {
    const d = deps();
    await resolveQuestion(claim({ date: "2026-02-22" }), question, d);
    const prompt = (d.ask.askWithTools as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(prompt).toContain("did X happen?");
    expect(prompt).toContain("neutral hypothetical");
  });

  it("runs each of the model's searches inside the claim's centered date window", async () => {
    const d = deps();
    await resolveQuestion(claim({ date: "2026-02-22" }), question, d);
    expect(d.search).toHaveBeenCalledWith("model query 1", {
      startPublishedDate: "2026-01-23",
      endPublishedDate: "2026-03-08",
    });
  });

  it("searches with no date window when the claim has no date", async () => {
    const d = deps();
    await resolveQuestion(claim(), question, d);
    expect(d.search).toHaveBeenCalledWith("model query 1", undefined);
  });

  it("accumulates and dedupes evidence by url across the model's searches", async () => {
    const search = vi.fn(async (q: string) =>
      q === "q1" ? [rawSource("a.com"), rawSource("b.com")] : [rawSource("b.com"), rawSource("c.com")],
    );
    // classify zips one stance per source positionally; 3 unique sources → 3 classifications.
    const askJSON = vi.fn().mockResolvedValue(
      Array.from({ length: 3 }, () => ({
        stance: "supports",
        reliability: "high",
        sourceType: "primary",
        stanceConfidence: 0.9,
      })),
    );
    const d = deps(
      { search, ask: { askText: vi.fn().mockResolvedValue("h"), askJSON, askWithTools: fakeModel(["q1", "q2"]) } },
      ["q1", "q2"],
    );

    const out = await resolveQuestion(claim(), question, d);
    expect(search).toHaveBeenCalledTimes(2);
    // 4 raw results (b.com twice) collapse to 3 unique evidence items.
    expect(out.map((e) => e.domain).sort()).toEqual(["a.com", "b.com", "c.com"]);
  });
});
