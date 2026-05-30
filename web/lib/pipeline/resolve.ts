import type { ClaimItem, QuestionItem, EvidenceItem, Verdict } from "../graph-types";
import type { PipelineDeps } from "./deps";
import { classifyEvidence } from "./classify";

/** Retrieve (de novo) + classify the evidence answering one question. */
export async function resolveQuestion(
  claim: ClaimItem,
  question: QuestionItem,
  deps: PipelineDeps,
): Promise<EvidenceItem[]> {
  const raw = await deps.search(question.text);
  return classifyEvidence(claim, question, raw, deps.ask);
}

/** A one-line advisory "why" — composed from the deciding evidence, never asserted as truth. */
export function rationaleFor(
  claim: ClaimItem,
  verdict: Verdict,
  evidence: EvidenceItem[],
): string {
  if (!claim.checkable) {
    return "Rests on imagery or media provenance this text-only build cannot verify.";
  }
  if (verdict === "nei") {
    return "No usable primary evidence found for this claim.";
  }
  const deciding = pickDeciding(verdict, evidence);
  const domains = uniqueDomains(deciding);
  switch (verdict) {
    case "supported":
      return `Supported by ${domains}.`;
    case "refuted":
      return `Refuted by ${domains} (e.g. an official denial or contradicting report).`;
    case "conflicting":
      return `Sources conflict — both supporting and refuting primary evidence found (${domains}).`;
    default:
      return "";
  }
}

function pickDeciding(verdict: Verdict, evidence: EvidenceItem[]): EvidenceItem[] {
  if (verdict === "supported") return evidence.filter((e) => e.stance === "supports");
  if (verdict === "refuted") return evidence.filter((e) => e.stance === "refutes");
  return evidence;
}

function uniqueDomains(evidence: EvidenceItem[]): string {
  const domains = [...new Set(evidence.map((e) => e.domain))];
  if (domains.length === 0) return "the retrieved sources";
  if (domains.length <= 2) return domains.join(" and ");
  return `${domains.slice(0, 2).join(", ")} and others`;
}
