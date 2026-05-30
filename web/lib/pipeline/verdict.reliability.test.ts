import { describe, it, expect } from "vitest";
import { claimVerdict } from "./verdict";
import type { ClaimItem, EvidenceItem, Reliability, Stance } from "../graph-types";

// VERITRACE's stated principle (CONTEXT.md): a verdict's uncertainty lives in SOURCE
// RELIABILITY, not a bare confidence %. So a low-reliability source can only contextualize —
// it must not establish or flip a verdict on its own; only high/medium reliability decides.
// These cases pin that. They complement verdict.test.ts, which fixes reliability at "high".

function claim(checkable = true): ClaimItem {
  return { id: "c1", text: "a claim", checkable, verdict: null };
}

let evId = 0;
function evidence(stance: Stance, reliability: Reliability, stanceConfidence = 0.9): EvidenceItem {
  return {
    id: `e${evId++}`,
    questionId: "q1",
    title: "t",
    url: "https://example.com/x",
    domain: "example.com",
    passage: "p",
    stance,
    reliability,
    sourceType: "primary",
    stanceConfidence,
  };
}

describe("claimVerdict — reliability is load-bearing, not decorative", () => {
  it("a confident but low-reliability source alone cannot establish a verdict", () => {
    expect(claimVerdict(claim(), [evidence("supports", "low", 0.95)])).toBe("nei");
  });

  it("a low-reliability refutation cannot manufacture a conflict against a high-reliability support", () => {
    const ev = [evidence("supports", "high", 0.9), evidence("refutes", "low", 0.95)];
    expect(claimVerdict(claim(), ev)).toBe("supported");
  });

  it("two confident low-reliability sources on opposite sides stay NEI, not Conflicting", () => {
    const ev = [evidence("supports", "low", 0.95), evidence("refutes", "low", 0.95)];
    expect(claimVerdict(claim(), ev)).toBe("nei");
  });

  it("medium reliability still decides", () => {
    expect(claimVerdict(claim(), [evidence("refutes", "medium", 0.8)])).toBe("refuted");
  });

  it("a high-reliability source decides through low-reliability noise on the same side", () => {
    const ev = [evidence("refutes", "high", 0.9), evidence("refutes", "low", 0.95)];
    expect(claimVerdict(claim(), ev)).toBe("refuted");
  });
});
