import type { AnthropicCaller } from "../anthropic";
import type {
  ClaimItem,
  QuestionItem,
  EvidenceItem,
  Stance,
  Reliability,
  SourceType,
} from "../graph-types";
import type { RawEvidence } from "../exa";

const SYSTEM = `You are the evidence-classification stage of VERITRACE. Given a claim, the question being resolved, and a set of retrieved sources (domain + title + passage), classify EACH source relative to the CLAIM.

For each source decide:
- "stance": "supports" (the passage gives evidence the claim is true), "refutes" (evidence it is false — including an official denial of the claimed event), or "contextualizes" (relevant background that neither confirms nor denies).
- "reliability": "high" (news wire, major outlet, official government/agency statement, primary registry), "medium" (regional outlet, secondary reporting), "low" (blog, social aggregator, anonymous, content farm).
- "sourceType": "primary" (the originating report, official statement, or wire), "secondary" (re-reporting of a primary source), "opinion" (op-ed / commentary).
- "stanceConfidence": 0.0–1.0, how clearly the passage takes that stance toward the claim.

Be skeptical: a passage that merely repeats the viral claim without verification is "contextualizes", not "supports". An authority's denial is "refutes" with high reliability.

Respond with ONLY a JSON array, one object per source IN THE SAME ORDER, no prose:
[{ "stance": "...", "reliability": "...", "sourceType": "...", "stanceConfidence": 0.0 }]`;

interface Classification {
  stance: Stance;
  reliability: Reliability;
  sourceType: SourceType;
  stanceConfidence: number;
}

export async function classifyEvidence(
  claim: ClaimItem,
  question: QuestionItem,
  raw: RawEvidence[],
  ask: AnthropicCaller,
): Promise<EvidenceItem[]> {
  if (raw.length === 0) return [];

  const sources = raw
    .map(
      (r, i) =>
        `[${i}] domain: ${r.domain}\n    title: ${r.title}\n    passage: ${r.passage || "(no excerpt retrieved)"}`,
    )
    .join("\n\n");

  const classifications = await ask.askJSON<Classification[]>(
    `Claim: "${claim.text}"\nQuestion: "${question.text}"\n\nSources:\n${sources}\n\nClassify each source.`,
    { system: SYSTEM, maxTokens: 800 },
  );

  return raw.map((r, i) => {
    const c = classifications[i] ?? {
      stance: "contextualizes" as Stance,
      reliability: "low" as Reliability,
      sourceType: "secondary" as SourceType,
      stanceConfidence: 0.3,
    };
    return {
      id: `${question.id}-e${i + 1}`,
      questionId: question.id,
      title: r.title,
      url: r.url,
      domain: r.domain,
      faviconUrl: r.faviconUrl,
      publishedDate: r.publishedDate,
      passage: r.passage,
      stance: c.stance,
      reliability: c.reliability,
      sourceType: c.sourceType,
      stanceConfidence: c.stanceConfidence,
    };
  });
}
