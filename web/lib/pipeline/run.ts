import type {
  FactGraph,
  ClaimItem,
  QuestionItem,
  EvidenceItem,
  Verdict,
} from "../graph-types";
import { retrieveEvidence } from "../exa";
import { extractClaims } from "./extract";
import { generateQuestions } from "./questions";
import { classifyEvidence } from "./classify";
import { claimVerdict, sourceVerdict } from "./verdict";

/**
 * Run the full VERITRACE pipeline non-streaming and return the finished graph.
 * Source text → extract+decontextualize Claims → per claim ask Questions → per
 * question retrieve Evidence (de novo) → classify stance → aggregate Verdicts.
 *
 * Fan-out is parallel per claim and per question so total latency tracks the slowest
 * single chain, not the sum (PLAN.md latency mitigation).
 */
export async function runPipeline(sourceText: string): Promise<FactGraph> {
  const claims = await extractClaims(sourceText);

  const perClaim = await Promise.all(
    claims.map(async (claim) => {
      const questions = await generateQuestions(claim);
      const questionResults = await Promise.all(
        questions.map((q) => resolveQuestion(claim, q)),
      );
      const evidence = questionResults.flatMap((r) => r.evidence);
      const verdict = claimVerdict(claim, evidence);
      return {
        claim: { ...claim, verdict, rationale: rationaleFor(claim, verdict, evidence) },
        questions: questionResults.map((r) => r.question),
        evidence,
      };
    }),
  );

  const resolvedClaims: ClaimItem[] = perClaim.map((p) => p.claim);
  const allQuestions: QuestionItem[] = perClaim.flatMap((p) => p.questions);
  const allEvidence: EvidenceItem[] = perClaim.flatMap((p) => p.evidence);

  return {
    source: {
      id: "src",
      text: sourceText,
      verdict: sourceVerdict(resolvedClaims.map((c) => c.verdict ?? "nei")),
    },
    claims: resolvedClaims,
    questions: allQuestions,
    evidence: allEvidence,
  };
}

async function resolveQuestion(
  claim: ClaimItem,
  question: QuestionItem,
): Promise<{ question: QuestionItem; evidence: EvidenceItem[] }> {
  const raw = await retrieveEvidence(question.text);
  const evidence = await classifyEvidence(claim, question, raw);
  return { question: { ...question, status: "answered" }, evidence };
}

/** A one-line advisory "why" — composed from the deciding evidence, never asserted as truth. */
function rationaleFor(
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
