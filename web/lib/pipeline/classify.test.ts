import { describe, it, expect, vi, beforeEach } from "vitest";

const { askJSON } = vi.hoisted(() => ({ askJSON: vi.fn() }));
vi.mock("../anthropic", () => ({ askJSON }));

import { classifyEvidence } from "./classify";
import type { ClaimItem, QuestionItem } from "../graph-types";
import type { RawEvidence } from "../exa";

const claim: ClaimItem = { id: "c1", text: "claim", checkable: true, verdict: null };
const question: QuestionItem = { id: "c1-q1", claimId: "c1", text: "q?", status: "searching" };

function raw(over: Partial<RawEvidence> = {}): RawEvidence {
  return {
    title: "Title",
    url: "https://bbc.com/x",
    domain: "bbc.com",
    faviconUrl: "https://bbc.com/fav.ico",
    publishedDate: "2026-02-22",
    passage: "a passage",
    ...over,
  };
}

beforeEach(() => askJSON.mockReset());

describe("classifyEvidence", () => {
  it("returns nothing and skips the model when there is no raw evidence", async () => {
    const out = await classifyEvidence(claim, question, []);
    expect(out).toEqual([]);
    expect(askJSON).not.toHaveBeenCalled();
  });

  it("zips classifications onto raw sources positionally", async () => {
    askJSON.mockResolvedValue([
      { stance: "supports", reliability: "high", sourceType: "primary", stanceConfidence: 0.9 },
      { stance: "refutes", reliability: "medium", sourceType: "secondary", stanceConfidence: 0.7 },
    ]);
    const out = await classifyEvidence(claim, question, [
      raw({ domain: "a.com" }),
      raw({ domain: "b.com" }),
    ]);
    expect(out[0]).toMatchObject({ domain: "a.com", stance: "supports", reliability: "high" });
    expect(out[1]).toMatchObject({ domain: "b.com", stance: "refutes", reliability: "medium" });
  });

  it("generates evidence ids namespaced under the question id", async () => {
    askJSON.mockResolvedValue([
      { stance: "supports", reliability: "high", sourceType: "primary", stanceConfidence: 0.9 },
      { stance: "supports", reliability: "high", sourceType: "primary", stanceConfidence: 0.9 },
    ]);
    const out = await classifyEvidence(claim, question, [raw(), raw()]);
    expect(out.map((e) => e.id)).toEqual(["c1-q1-e1", "c1-q1-e2"]);
  });

  it("carries provenance fields through from the raw source unchanged", async () => {
    askJSON.mockResolvedValue([
      { stance: "supports", reliability: "high", sourceType: "primary", stanceConfidence: 0.9 },
    ]);
    const [e] = await classifyEvidence(claim, question, [
      raw({ title: "Headline", url: "https://x.com/a", publishedDate: "2026-01-01" }),
    ]);
    expect(e).toMatchObject({
      questionId: "c1-q1",
      title: "Headline",
      url: "https://x.com/a",
      publishedDate: "2026-01-01",
      passage: "a passage",
    });
  });

  it("falls back to a low-confidence contextual classification when one is missing", async () => {
    // Model returned fewer classifications than sources — the extra source must still map.
    askJSON.mockResolvedValue([
      { stance: "supports", reliability: "high", sourceType: "primary", stanceConfidence: 0.9 },
    ]);
    const out = await classifyEvidence(claim, question, [raw(), raw()]);
    expect(out[1]).toMatchObject({
      stance: "contextualizes",
      reliability: "low",
      sourceType: "secondary",
      stanceConfidence: 0.3,
    });
  });
});
