import { describe, it, expect } from "vitest";
import { rationaleFor } from "./resolve";
import type { ClaimItem, EvidenceItem, Stance } from "../graph-types";

function claim(over: Partial<ClaimItem> = {}): ClaimItem {
  return { id: "c1", text: "a claim", checkable: true, verdict: null, ...over };
}

let evId = 0;
function evidence(stance: Stance, domain: string): EvidenceItem {
  return {
    id: `e${evId++}`,
    questionId: "q1",
    title: "t",
    url: `https://${domain}/x`,
    domain,
    passage: "p",
    stance,
    reliability: "high",
    sourceType: "primary",
    stanceConfidence: 0.9,
  };
}

describe("rationaleFor", () => {
  it("explains an unckeckable claim by its media-provenance limit, ignoring verdict", () => {
    const text = rationaleFor(claim({ checkable: false }), "nei", []);
    expect(text).toMatch(/imagery or media provenance/i);
  });

  it("explains nei by the absence of usable primary evidence", () => {
    expect(rationaleFor(claim(), "nei", [])).toMatch(/no usable primary evidence/i);
  });

  it("names the supporting domains for a supported verdict", () => {
    const ev = [evidence("supports", "bbc.com"), evidence("supports", "reuters.com")];
    expect(rationaleFor(claim(), "supported", ev)).toBe("Supported by bbc.com and reuters.com.");
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
    expect(rationaleFor(claim(), "supported", ev)).toBe("Supported by bbc.com.");
  });

  it("summarizes three-plus domains as 'a, b and others'", () => {
    const ev = [
      evidence("supports", "a.com"),
      evidence("supports", "b.com"),
      evidence("supports", "c.com"),
    ];
    expect(rationaleFor(claim(), "supported", ev)).toBe("Supported by a.com, b.com and others.");
  });

  it("considers both stances as deciding for a conflicting verdict", () => {
    const ev = [evidence("supports", "bbc.com"), evidence("refutes", "cnn.com")];
    const text = rationaleFor(claim(), "conflicting", ev);
    expect(text).toContain("bbc.com");
    expect(text).toContain("cnn.com");
    expect(text).toMatch(/conflict/i);
  });

  it("falls back to a generic phrase when the deciding set has no domains", () => {
    // supported verdict but no supporting evidence present → no domains to name.
    const text = rationaleFor(claim(), "supported", [evidence("refutes", "x.com")]);
    expect(text).toBe("Supported by the retrieved sources.");
  });
});
