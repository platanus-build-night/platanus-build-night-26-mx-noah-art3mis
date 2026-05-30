import { describe, it, expect, vi, beforeEach } from "vitest";

// Capture the options passed to Exa.search so we can assert de-novo exclusion etc.
const searchMock = vi.fn();

vi.mock("exa-js", () => {
  return {
    default: class FakeExa {
      constructor(public key: string) {}
      search = searchMock;
    },
  };
});

import { retrieveEvidence, FACT_CHECKERS } from "./exa";

beforeEach(() => {
  searchMock.mockReset();
  process.env.EXA_API_KEY = "test-key";
});

function withResults(results: unknown[]) {
  searchMock.mockResolvedValue({ results });
}

describe("retrieveEvidence de-novo retrieval", () => {
  it("excludes every fact-check outlet from the search (the honesty bar)", async () => {
    withResults([]);
    await retrieveEvidence("did X happen?");
    const opts = searchMock.mock.calls[0][1];
    expect(opts.excludeDomains).toEqual(FACT_CHECKERS);
  });

  it("caps results for graph legibility and requests highlights+text", async () => {
    withResults([]);
    await retrieveEvidence("did X happen?");
    const opts = searchMock.mock.calls[0][1];
    expect(opts.numResults).toBe(2);
    expect(opts.contents.highlights).toBe(true);
    expect(opts.contents.text.maxCharacters).toBe(800);
  });

  it("passes the question text through as the query", async () => {
    withResults([]);
    await retrieveEvidence("did X happen?");
    expect(searchMock.mock.calls[0][0]).toBe("did X happen?");
  });
});

describe("retrieveEvidence mapping", () => {
  it("derives the bare domain from the url, stripping www.", async () => {
    withResults([{ url: "https://www.bbc.co.uk/news/x", title: "T", highlights: ["h"] }]);
    const [ev] = await retrieveEvidence("q");
    expect(ev.domain).toBe("bbc.co.uk");
  });

  it("prefers the first highlight as the passage", async () => {
    withResults([
      { url: "https://x.com", title: "T", highlights: ["the highlight"], text: "the full text" },
    ]);
    const [ev] = await retrieveEvidence("q");
    expect(ev.passage).toBe("the highlight");
  });

  it("falls back to text when no highlight is present", async () => {
    withResults([{ url: "https://x.com", title: "T", text: "  the full text  " }]);
    const [ev] = await retrieveEvidence("q");
    expect(ev.passage).toBe("the full text");
  });

  it("falls back to the url as title when the result has none", async () => {
    withResults([{ url: "https://x.com/a", highlights: ["h"] }]);
    const [ev] = await retrieveEvidence("q");
    expect(ev.title).toBe("https://x.com/a");
  });

  it("uses the provided favicon when present", async () => {
    withResults([{ url: "https://x.com", title: "T", favicon: "https://x.com/fav.ico", highlights: ["h"] }]);
    const [ev] = await retrieveEvidence("q");
    expect(ev.faviconUrl).toBe("https://x.com/fav.ico");
  });

  it("synthesizes a google s2 favicon url when the result lacks one", async () => {
    withResults([{ url: "https://x.com", title: "T", highlights: ["h"] }]);
    const [ev] = await retrieveEvidence("q");
    expect(ev.faviconUrl).toBe("https://www.google.com/s2/favicons?domain=x.com&sz=64");
  });

  it("truncates the published date to a YYYY-MM-DD day", async () => {
    withResults([
      { url: "https://x.com", title: "T", highlights: ["h"], publishedDate: "2026-02-22T14:26:00Z" },
    ]);
    const [ev] = await retrieveEvidence("q");
    expect(ev.publishedDate).toBe("2026-02-22");
  });

  it("returns an empty passage when neither highlight nor text is available", async () => {
    withResults([{ url: "https://x.com", title: "T" }]);
    const [ev] = await retrieveEvidence("q");
    expect(ev.passage).toBe("");
  });
});

describe("retrieveEvidence configuration", () => {
  it("throws a clear error when EXA_API_KEY is unset", async () => {
    // The lazy client is module-scoped; force a fresh module so the unset key is seen.
    delete process.env.EXA_API_KEY;
    vi.resetModules();
    const { retrieveEvidence: fresh } = await import("./exa");
    await expect(fresh("q")).rejects.toThrow(/EXA_API_KEY/);
  });
});
