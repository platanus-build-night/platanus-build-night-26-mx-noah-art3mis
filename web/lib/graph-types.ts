// The VERITRACE 4-layer evidence-graph schema: Source text → Claims → Questions → Evidence.
// This is the contract the pipeline (P1) emits and the renderer (P2/P3) consumes.

export type Verdict = "supported" | "refuted" | "conflicting" | "nei";
export type Stance = "supports" | "refutes" | "contextualizes";
export type Reliability = "high" | "medium" | "low";
export type SourceType = "primary" | "secondary" | "opinion";
export type QuestionStatus = "pending" | "searching" | "answered";

/** A retrieved primary source answering a Question; carries provenance + stance. */
export interface EvidenceItem {
  id: string;
  questionId: string;
  title: string;
  url: string;
  domain: string;
  faviconUrl?: string;
  publishedDate?: string; // ISO
  passage: string; // the answering excerpt (Exa highlight)
  stance: Stance;
  reliability: Reliability;
  sourceType: SourceType;
  stanceConfidence?: number; // 0..1
}

/** A question the system generates to resolve a Claim (QA-pair = explanation). */
export interface QuestionItem {
  id: string;
  claimId: string;
  text: string;
  status: QuestionStatus;
}

/** An atomic, decontextualized checkable assertion extracted from the Source text. */
export interface ClaimItem {
  id: string;
  text: string; // decontextualized (date/place/actor injected)
  original?: string; // raw fragment as it appeared in the source text
  verdict: Verdict | null; // null until resolved
  rationale?: string; // one-line why, advisory
  /** false = provenance/synthetic/origin type this text build can't check → NEI by design. */
  checkable: boolean;
}

/** The raw pasted blob (tweet / post / message / article). Root of the graph. */
export interface SourceTextItem {
  id: string;
  text: string;
  verdict: Verdict | null; // aggregated, advisory
}

/** The whole graph, flat by layer; edges are implied by the *Id back-references. */
export interface FactGraph {
  source: SourceTextItem;
  claims: ClaimItem[];
  questions: QuestionItem[];
  evidence: EvidenceItem[];
}
