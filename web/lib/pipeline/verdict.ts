import type { ClaimItem, EvidenceItem, Verdict } from "../graph-types";

// Deterministic verdict aggregation — STATED, not learned (PLAN.md). The pipeline's
// job is to gather evidence transparently; the mapping from evidence to verdict is a
// fixed rule the user can inspect, not a black-box judgement.

// Evidence below this stance-confidence is treated as too weak to move a verdict.
const MIN_CONFIDENCE = 0.5;

/** Aggregate a single claim's evidence into its advisory Verdict. */
export function claimVerdict(claim: ClaimItem, evidence: EvidenceItem[]): Verdict {
  // Claims a text+web build can't check (media provenance / synthetic) → NEI by design.
  if (!claim.checkable) return "nei";

  const usable = evidence.filter((e) => (e.stanceConfidence ?? 0) >= MIN_CONFIDENCE);
  const supports = usable.some((e) => e.stance === "supports");
  const refutes = usable.some((e) => e.stance === "refutes");

  if (supports && refutes) return "conflicting";
  if (refutes) return "refuted";
  if (supports) return "supported";
  // Only contextual evidence, or nothing usable → Not-Enough-Evidence.
  return "nei";
}

/**
 * Aggregate resolved claims into the source-text-level assessment. NEI claims do not
 * dominate at this level (otherwise one unverifiable fragment would sink the whole
 * document); they're simply excluded. A document mixing Supported and Refuted claims —
 * the El Mencho hero story — surfaces as Conflicting.
 */
export function sourceVerdict(claimVerdicts: Verdict[]): Verdict {
  const resolved = claimVerdicts.filter((v) => v !== "nei");
  if (resolved.length === 0) return "nei";

  const supported = resolved.some((v) => v === "supported");
  const refuted = resolved.some((v) => v === "refuted");
  const conflicting = resolved.some((v) => v === "conflicting");

  if (conflicting || (supported && refuted)) return "conflicting";
  if (refuted) return "refuted";
  return "supported";
}
