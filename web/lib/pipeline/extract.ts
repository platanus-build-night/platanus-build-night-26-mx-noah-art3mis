import { askJSON } from "../anthropic";
import type { ClaimItem } from "../graph-types";

// Legibility cap (PLAN.md): a graph that reads in 5 seconds on a slide.
const MAX_CLAIMS = 3;

interface ExtractedClaim {
  text: string;
  original: string;
  checkable: boolean;
}

const SYSTEM = `You are the claim-extraction stage of VERITRACE, a fact-checking pipeline in the document-first tradition (SAFE / FacTool / Loki). You receive a raw "source text" — a tweet, WhatsApp forward, Facebook caption, or pasted article, often viral misinformation. Your job is to extract the atomic, checkable assertions.

Rules:
- DECONTEXTUALIZE every claim (mandatory). Inject the date, place, and actor from the surrounding source text so each claim stands alone and is searchable. A bare fragment like "they seized the airport" is unsearchable; rewrite to "Armed CJNG members seized Guadalajara International Airport around 22 February 2026". Balance decontextuality with minimality — one verifiable assertion per claim ("molecular facts").
- Extract at most ${MAX_CLAIMS} claims — the most load-bearing, distinct assertions. Merge near-duplicates.
- Translate each claim to clear English (the source may be Spanish or other).
- Mark "checkable": true if the claim can be verified from text + web search (events, existence, official actions/denials, statements). Mark "checkable": false if verifying it would require inspecting pixels or media provenance — e.g. "this video shows X", "the city is in flames" (resting on an image), synthetic-media or origin-trace claims. A text+web build cannot honestly check those; they will resolve to Not-Enough-Evidence by design.

Respond with ONLY a JSON array, no prose:
[{ "text": "<decontextualized English claim>", "original": "<the fragment as it appeared in the source>", "checkable": true|false }]`;

export async function extractClaims(sourceText: string): Promise<ClaimItem[]> {
  const claims = await askJSON<ExtractedClaim[]>(
    `Source text:\n"""\n${sourceText}\n"""\n\nExtract the atomic claims as instructed.`,
    { system: SYSTEM, maxTokens: 1500 },
  );

  return claims.slice(0, MAX_CLAIMS).map((c, i) => ({
    id: `c${i + 1}`,
    text: c.text,
    original: c.original,
    checkable: c.checkable !== false,
    verdict: null,
  }));
}
