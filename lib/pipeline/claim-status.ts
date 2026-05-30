import type { ClaimItem } from "../graph-types";

// The three orthogonal gates that decide what happens to an extracted claim, in SAFE's
// shape (split → decontextualize → relevance-filter → rate). Kept as small pure predicates
// so questions / verdict / stream / renderer all agree on one definition.
//
//   checkable    — can a text+web build verify it at all? (false = media/provenance)
//   checkworthy  — is it a verifiable factual assertion? (false = opinion/prediction)
//   relevant     — is it the load-bearing contested claim, vs trivial background? (false = drop)

/** A claim worth spending a search on: text-verifiable, factual, and the contested assertion. */
export function isSearchable(claim: ClaimItem): boolean {
  return claim.checkable && claim.checkworthy !== false && claim.relevant !== false;
}

/** A claim the relevance filter removed before search — shown for legibility, never checked, not tallied. */
export function isRelevanceDropped(claim: ClaimItem): boolean {
  return claim.relevant === false;
}

export type DropReason = "irrelevant" | "uncheckworthy" | "uncheckable";

/**
 * Why a claim won't be searched, for display — relevance is shown as "dropped"; the other
 * two keep their existing NEI-by-design treatment. Null when the claim is searchable.
 */
export function dropReason(claim: ClaimItem): DropReason | null {
  if (isRelevanceDropped(claim)) return "irrelevant";
  if (!claim.checkable) return "uncheckable";
  if (claim.checkworthy === false) return "uncheckworthy";
  return null;
}
