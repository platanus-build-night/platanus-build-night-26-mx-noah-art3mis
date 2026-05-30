import Exa from "exa-js";

// Fact-check outlets are EXCLUDED from every retrieval. This is the mechanical
// enforcement of VERITRACE's de-novo honesty bar: the pipeline must reach its own
// verdict from primary evidence, never by reading a third party's finished
// fact-check. These same outlets live in demo-corpus/SOURCES.md as the *answer key*
// (grading only) — they are never fed into the graph. See CONTEXT.md / PLAN.md.
export const FACT_CHECKERS = [
  "politifact.com",
  "afp.com",
  "factchequeado.com",
  "fullfact.org",
  "snopes.com",
  "mediabiasfactcheck.com",
  "newsguardrealitycheck.com",
  "revistaespejo.com",
  "lacuartatransformacion.org",
  "verificat.cat",
  "prensalibre.com",
];

let client: Exa | null = null;
function exa(): Exa {
  if (!client) {
    if (!process.env.EXA_API_KEY) throw new Error("EXA_API_KEY is not set");
    client = new Exa(process.env.EXA_API_KEY);
  }
  return client;
}

export interface RawEvidence {
  title: string;
  url: string;
  domain: string;
  faviconUrl?: string;
  publishedDate?: string;
  /** Query-relevant excerpt (Exa highlight) → the Evidence passage; falls back to text. */
  passage: string;
}

/**
 * One Exa search per Question node. Direct call — not Claude function-calling — because
 * our pipeline is deterministic: we decide when to search. `excludeDomains` enforces
 * de-novo retrieval. `type: "auto"` is the balanced ~1s default; numResults caps the
 * graph for legibility. We omit `maxAgeHours` so cache is served (livecrawl as fallback),
 * which is what makes rehearsed demo chips return fast on stage.
 */
export async function retrieveEvidence(questionText: string): Promise<RawEvidence[]> {
  const { results } = await exa().search(questionText, {
    type: "auto",
    numResults: 2,
    excludeDomains: FACT_CHECKERS,
    contents: {
      highlights: true,
      text: { maxCharacters: 800 },
    },
  });

  return results.map((r) => {
    const highlight = Array.isArray(r.highlights) ? r.highlights[0] : undefined;
    const passage = (highlight || r.text || "").trim();
    return {
      title: r.title ?? r.url,
      url: r.url,
      domain: domainOf(r.url),
      faviconUrl: r.favicon || faviconFor(r.url),
      publishedDate: r.publishedDate?.slice(0, 10),
      passage,
    };
  });
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function faviconFor(url: string): string {
  return `https://www.google.com/s2/favicons?domain=${domainOf(url)}&sz=64`;
}
