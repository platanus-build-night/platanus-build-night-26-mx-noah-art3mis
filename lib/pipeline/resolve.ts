import type { ClaimItem, QuestionItem, EvidenceItem, Verdict } from "../graph-types";
import type { SearchOptions, RawEvidence } from "../exa";
import type { ToolDef } from "../anthropic";
import type { PipelineDeps } from "./deps";
import { classifyEvidence } from "./classify";
import { expandQuery } from "./expand";

// Days of slack around a claim's event date for the retrieval window. The lower bound cuts
// stale/unrelated older matches; the upper bound keeps the day-of and following-week
// primary reporting that actually settles a breaking-news claim, while excluding much later
// re-litigation. Fact-check outlets are excluded by domain regardless of date.
const WINDOW_BEFORE_DAYS = 30;
const WINDOW_AFTER_DAYS = 14;
const MS_PER_DAY = 86_400_000;

/** A centered publication window around a claim's event date, or undefined if no date is known. */
export function dateWindow(date?: string): SearchOptions | undefined {
  if (!date) return undefined;
  const t = Date.parse(date);
  if (Number.isNaN(t)) return undefined;
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  return {
    startPublishedDate: iso(t - WINDOW_BEFORE_DAYS * MS_PER_DAY),
    endPublishedDate: iso(t + WINDOW_AFTER_DAYS * MS_PER_DAY),
  };
}

// How many model↔search round-trips the gather loop may take before we stop and judge what
// we have. The model is told to keep searching until it has MIN_DECIDING reliable sources
// including one primary; this is the hard backstop on that model-driven loop.
const MAX_SEARCHES = 4;
const MIN_DECIDING = 2;

const GATHER_SYSTEM = `You are the evidence-gathering stage of VERITRACE, resolving ONE question about ONE claim de novo by searching the open web with the search_evidence tool.

How to search:
- Issue focused, standalone queries (keep the date / place / actor so keyword search anchors).
- KEEP SEARCHING until you have at least ${MIN_DECIDING} reliable sources that take a CLEAR stance on the claim, INCLUDING at least one PRIMARY source — the originating report, an official statement, or a news wire — not just re-reporting that echoes the viral claim.
- Vary the angle across calls: the event itself, whether authorities CONFIRMED or DENIED it, and the originating outlet. Don't repeat a query that already returned good results.
- Stop once the bar is met, or once reasonable queries are exhausted. Never fabricate — only the tool's results count.

When done, reply with a one-line summary of what you found.`;

const SEARCH_TOOL: ToolDef = {
  name: "search_evidence",
  description:
    "Search the open web for primary evidence answering the question. Returns up to a few sources (domain, title, dated passage). Call repeatedly with different focused queries.",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "A focused, standalone web query (include date/place/actor)." },
    },
    required: ["query"],
  },
};

/**
 * Agentic retrieve (de novo) + classify for one question. The model drives a search loop —
 * issuing focused queries until it has ≥2 reliable sources incl. ≥1 primary, or MAX_SEARCHES
 * is hit — and we accumulate every retrieved source (deduped by url), then run the
 * deterministic classifier over the full set. We seed the loop with a HyDE-expanded query and
 * keep each search inside the claim's date window, so the model's judgment governs only *when
 * to stop searching* while the stated classify + verdict rules stay authoritative.
 */
export async function resolveQuestion(
  claim: ClaimItem,
  question: QuestionItem,
  deps: PipelineDeps,
): Promise<EvidenceItem[]> {
  const window = dateWindow(claim.date);
  const collected = new Map<string, RawEvidence>();

  async function onTool(name: string, input: unknown): Promise<unknown> {
    if (name !== "search_evidence") return { error: `unknown tool: ${name}` };
    const query = (input as { query?: string }).query ?? "";
    const results = await deps.search(query, window);
    for (const r of results) collected.set(r.url, r); // dedup by url across queries
    return results;
  }

  // Seed with a HyDE-expanded query (HerO/HyDE retrieval); the model issues follow-ups.
  const seed = await expandQuery(claim, question, deps.ask);
  await deps.ask.askWithTools(
    `Claim: "${claim.text}"\nQuestion: "${question.text}"\n\nA strong first query to run:\n${seed}\n\nGather the evidence that resolves this question.`,
    { system: GATHER_SYSTEM, tools: [SEARCH_TOOL], onTool, maxSteps: MAX_SEARCHES, maxTokens: 600 },
  );

  return classifyEvidence(claim, question, [...collected.values()], deps.ask);
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
  if (claim.checkworthy === false) {
    return "Subjective or opinion statement — not a checkable factual assertion.";
  }
  if (verdict === "nei") {
    // Make the insufficiency self-explaining (Kotonya & Toni; CLUE): say WHY, not just NEI.
    if (evidence.length === 0) {
      return "No primary sources answered this claim's questions.";
    }
    const found = uniqueDomains(evidence);
    const n = evidence.length;
    return `Found ${n} source${n === 1 ? "" : "s"} (${found}) but none cleared the reliability and clarity bar.`;
  }
  const deciding = pickDeciding(verdict, evidence);
  const domains = uniqueDomains(deciding);
  // Surface whether we actually reached an originating source — the heart of the de-novo
  // promise — without letting it gate the verdict (reliability still decides that).
  const provenance = deciding.some((e) => e.sourceType === "primary")
    ? "incl. a primary source"
    : "re-reporting only, no originating source located";
  switch (verdict) {
    case "supported":
      return `Supported by ${domains} — ${provenance}.`;
    case "refuted":
      return `Refuted by ${domains} — ${provenance}.`;
    case "conflicting":
      return `Sources conflict — both supporting and refuting evidence found (${domains}), ${provenance}.`;
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
