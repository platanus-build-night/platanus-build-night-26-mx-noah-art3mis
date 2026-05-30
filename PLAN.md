# VERITRACE — Prototype & Demo Plan

*The AI fact-checker that shows its work. You make the call.*

## What we're building (one breath)

A single Next.js app where a journalist pastes a news claim and watches an AI fact-check it **live**: the claim decomposes into atomic sub-claims, each sub-claim sprouts the questions needed to resolve it, and live web retrieval streams primary sources onto the canvas — rendered as a traversable, 4-layer evidence graph that builds itself node by node. Verdicts are nuanced (Supported / Refuted / Conflicting / Not-Enough-Evidence) and **advisory** — every node traces to a primary source so the human owns the final call. The differentiator is **granular observability of the machine's reasoning**, which no incumbent gives.

## Resolved decisions (see CONTEXT.md + ADR 0001)

| Axis            | Decision                                                                                  |
| --------------- | ----------------------------------------------------------------------------------------- |
| Hero            | Claim module (fake news), run deep + live. Integrity module out; slop is an optional stretch. |
| Backend         | DIY — Anthropic (decompose/verify) + Exa (retrieve). All NLP behind HTTP. No GPU, no Python. |
| Stack           | One Next.js (TS) app; React Flow canvas; deploy on Vercel.                                 |
| Interaction     | Read-only granular observability; graph builds live via streaming. Recompute = stretch.   |
| Graph schema    | 4 layers: Claim → Sub-claims → Questions → Evidence (QA-pair = explanation).               |
| Verdict         | AVeriTeC 4-way; uncertainty = source-reliability, not a bare %.                            |
| Demo input      | Curated example chips + live retrieval + per-chip cached fallback; free-paste available.   |

## Graph schema (the spine everything streams into)

```
Node types:
  claim      { id, text, verdict, verdictConfidence }
  subclaim   { id, text, verdict, verdictConfidence }
  question   { id, text, status: pending|searching|answered }
  evidence   { id, title, domain, faviconUrl, publishedDate, passage,
               sourceUrl, reliability: high|medium|low, sourceType: primary|secondary|opinion,
               stance: supports|refutes|contextualizes, stanceConfidence }

Edge types:
  decomposes_into   claim    -> subclaim
  asks              subclaim -> question
  answered_by       question -> evidence
  (evidence.stance colors the question->evidence edge: green/red/amber)

Verdict aggregation (sub-claim -> claim), deterministic, stated not learned:
  any Refuted subclaim                         -> claim leans Refuted
  mix of Supported + Refuted across subclaims   -> Conflicting
  all Supported                                -> Supported
  any subclaim with no usable evidence          -> Not-Enough-Evidence dominates
```

Demo legibility caps: ~3 sub-claims/claim, ~2 questions/sub-claim, 1–2 evidence/question → a graph that fits a slide and reads in 5 seconds.

## Retrieval honesty — the non-negotiable (see CONTEXT.md: De novo check)

The pipeline reaches Verdicts from **Primary evidence it gathers itself**, never from a third-party fact-check. Mechanically enforced: every Exa call sets `excludeDomains: [politifact.com, afp.com, factchequeado.com, fullfact.org, snopes.com, …]`. Fact-checks stay in `demo-corpus/SOURCES.md` as the **Answer key** (grading only), never fed in.

**Honest scope (don't over-claim on stage):** `excludeDomains` is a *best-effort denylist*, not a structural guarantee — it can't exclude the fact-check *sections* of general newsrooms (Reuters / AP / BBC Verify) or unlisted verifiers (Maldita, Newtral, EFE Verifica). So scope the on-stage line to *this* graph — "no fact-checker in these sources," which is verifiably true for the El Mencho evidence (BBC, Proceso, Cobertura360, OSAC) — rather than implying one can never slip in.

This build (text-in + web-search, no pixels, no reverse-image/geo/detector) can honestly check two sub-claim types de novo: **event/existence** and **official-denial**. It **cannot** check **media-provenance / synthetic-media / origin-trace** sub-claims — those correctly resolve to **Not-Enough-Evidence** (uncertainty-first, a feature). Pixel/provenance handling is a deferred stretch (image/video ingest + a hosted AI-media detector).

**Demo hero = Story 2 (El Mencho / Guadalajara airport):** "El Mencho died" → Supported (news wire); "CJNG seized the airport, US hostages" → Refuted (official authority/Embassy denial) — both de novo, zero fact-checkers in the evidence. On-stage flex: "notice, no fact-checkers in these sources — it re-derived the verdict from primaries."

### Exa retrieval call — canonical params (per the coding-agents guide)

One `exa.search()` per Question node. Direct call in the API route — **not** Claude function-calling (our pipeline is deterministic; we decide when to search, Claude doesn't). Verified against docs.exa.ai's coding-agents guide:

```ts
import Exa from "exa-js";
const exa = new Exa(process.env.EXA_API_KEY); // server-side only

const FACT_CHECKERS = [
  "politifact.com","afp.com","factchequeado.com","fullfact.org","snopes.com",
  "mediabiasfactcheck.com","newsguardrealitycheck.com","revistaespejo.com",
  "lacuartatransformacion.org","verificat.cat","prensalibre.com",
];

async function retrieveEvidence(questionText: string) {
  const { results } = await exa.search(questionText, {
    type: "auto",                 // ~1s, balanced — right default
    numResults: 2,                // legibility cap
    excludeDomains: FACT_CHECKERS, // de-novo honesty, enforced here
    // category: "news",          // SMOKE-TEST with excludeDomains first (400 risk); drop if it errors
    contents: {
      highlights: true,           // query-relevant excerpt = the Evidence passage (NOT numSentences — deprecated)
      text: { maxCharacters: 800, verbosity: "compact" }, // fallback passage; compact strips nav/footers
    },
  });
  return results; // -> map to Evidence nodes: url, title, favicon, publishedDate, highlights[0] ?? text
}
```

**Deprecated params to never use** (the guide's trap list): `numSentences`, `highlightsPerUrl`, `useAutoprompt`, `livecrawl:"always"`, `tokensNum`, top-level `text/highlights` on `/search` (must nest in `contents`).

**Freshness / demo-cache strategy:** omit `maxAgeHours` (default: serve cache, livecrawl as fallback). Do **not** set `maxAgeHours: 0` — it forces a slow livecrawl every run. Rehearsing the demo chips in P4/P5 **warms Exa's cache**, so on stage they return as fast cache hits — rehearsal doubles as cache-warming.

## Pipeline (one streamed request)

```
POST /api/check  (claim text)  -> streams events:
  1. claim.created
  2. LLM decompose         -> subclaim.created (xN)
  3. per subclaim: LLM     -> question.created (xM)
  4. per question: Exa     -> question.searching, then evidence.created (x1-2)
       Exa call MUST set excludeDomains:[fact-check outlets] -> de novo only,
       never rest the verdict on someone else's fact-check (see Retrieval honesty)
  5. per evidence: LLM     -> classify stance + reliability + sourceType
  6. per subclaim: aggregate -> subclaim.verdict
  7. aggregate             -> claim.verdict   (the finale beat)
```

Each event is appended to the React Flow graph on arrival with an enter-animation; questions show a "searching…" shimmer until their evidence lands.

## Build sequence (checkpointed — reorder freely, but keep the order of risk)

- **P0 · Scaffold** — Next.js app, React Flow canvas renders a hardcoded mock 4-layer graph, Anthropic + Exa SDKs wired, env keys in `.env.local`. *Done = mock graph on screen.*
- **P1 · Pipeline, non-streaming** — `/api/check` runs the full pipeline and returns the finished graph JSON. Correctness first; ignore animation. *Done = real claim → correct graph JSON.*
- **P2 · Schema + node cards** — map pipeline output to the 4 node types; auto-layout (dagre/elk); build the four card components — Claim/SubClaim verdict badges, Question chips, Evidence cards (favicon, domain, date, passage, reliability, stance color). *Done = a real claim renders as a beautiful static graph.*
- **P3 · Live streaming build** — convert the route to stream events (ReadableStream/SSE); client appends nodes/edges as they arrive with enter animations + "searching…" shimmer. *Done = watch-it-think works.*
- **P4 · Demo hardening** — curated example chips; per-chip cached response keyed to exact text (wifi-death fallback); tune chip claims for a textured/Conflicting graph; styling pass; empty/error states. *Done = demo is reliable + dramatic.*
- **P5 · Deploy + rehearse** — Vercel deploy + env vars; run on real/phone-hotspot wifi; time the 2-min script out loud 3×; **record a screen-capture of a perfect run as the ultimate fallback.** *Done = ready by ~01:00.*

**Stretch (only after P5 is solid):** article-URL ingest (paste a URL → extract the central claim); recompute-on-distrust (mark a source low-trust → re-aggregate); slop/AI-text signal on the source article (hosted detector, framed as triage not verdict).



## Top risks → mitigations

- **Live retrieval/LLM flakes on stage** → per-chip cached fallback + a pre-recorded video of a perfect run (P5).
- **Graph turns into a hairball** → hard legibility caps (3×2×2); no entity cross-links in core.
- **Boring all-green verdict** → demo chips hand-picked for a Conflicting/textured outcome (P4).
- **Streaming eats too much time** → P1/P2 deliver a fully working render-once demo; P3 streaming is an upgrade layered on a thing that already works, never a blocker.
- **Latency too slow to narrate** → parallelize per-sub-claim and per-question calls; target ~5–8s total.