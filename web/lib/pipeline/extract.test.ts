import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AnthropicCaller } from "../anthropic";

const askJSON = vi.fn();
const ask: AnthropicCaller = { askJSON, askText: vi.fn(), askWithTools: vi.fn() };

import { extractClaims } from "./extract";

beforeEach(() => askJSON.mockReset());

describe("extractClaims", () => {
  it("assigns sequential c1/c2 ids and starts every claim with a null verdict", async () => {
    askJSON.mockResolvedValue([
      { text: "claim one", original: "frag1", checkable: true },
      { text: "claim two", original: "frag2", checkable: true },
    ]);
    const claims = await extractClaims("source", ask, 5);
    expect(claims.map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(claims.every((c) => c.verdict === null)).toBe(true);
  });

  it("preserves the decontextualized text and the original fragment", async () => {
    askJSON.mockResolvedValue([{ text: "decontextualized", original: "raw bit", checkable: true }]);
    const [c] = await extractClaims("source", ask, 5);
    expect(c.text).toBe("decontextualized");
    expect(c.original).toBe("raw bit");
  });

  it("caps extraction at the configured limit even if the model returns more", async () => {
    askJSON.mockResolvedValue(
      Array.from({ length: 12 }, (_, i) => ({ text: `c${i}`, original: "o", checkable: true })),
    );
    expect(await extractClaims("source", ask, 5)).toHaveLength(5);
    expect(await extractClaims("source", ask, 10)).toHaveLength(10);
  });

  it("tells the model the claim limit in the system prompt", async () => {
    askJSON.mockResolvedValue([]);
    await extractClaims("source", ask, 7);
    expect(askJSON.mock.calls[0][1].system).toContain("7");
  });

  it("marks a claim uncheckable only when the model explicitly says false", async () => {
    askJSON.mockResolvedValue([{ text: "media claim", original: "o", checkable: false }]);
    const [c] = await extractClaims("source", ask, 5);
    expect(c.checkable).toBe(false);
  });

  it("defaults checkable to true when the model omits the field", async () => {
    askJSON.mockResolvedValue([{ text: "c", original: "o" }]);
    const [c] = await extractClaims("source", ask, 5);
    expect(c.checkable).toBe(true);
  });

  it("embeds the source text in the user prompt", async () => {
    askJSON.mockResolvedValue([]);
    await extractClaims("THE VIRAL POST", ask, 5);
    expect(askJSON.mock.calls[0][0]).toContain("THE VIRAL POST");
  });

  it("marks a claim non-checkworthy only when the model explicitly says false", async () => {
    askJSON.mockResolvedValue([{ text: "best ever", original: "o", checkable: true, checkworthy: false }]);
    const [c] = await extractClaims("source", ask, 5);
    expect(c.checkworthy).toBe(false);
  });

  it("defaults checkworthy to true when the model omits the field", async () => {
    askJSON.mockResolvedValue([{ text: "c", original: "o", checkable: true }]);
    const [c] = await extractClaims("source", ask, 5);
    expect(c.checkworthy).toBe(true);
  });

  it("carries the event date through and leaves it undefined when null", async () => {
    askJSON.mockResolvedValue([
      { text: "a", original: "o", checkable: true, date: "2026-02-22" },
      { text: "b", original: "o", checkable: true, date: null },
    ]);
    const claims = await extractClaims("source", ask, 5);
    expect(claims[0].date).toBe("2026-02-22");
    expect(claims[1].date).toBeUndefined();
  });

  it("flags decontextualizer-injected specifics absent from the source", async () => {
    askJSON.mockResolvedValue([
      { text: "The Blackpink compilation album was released in 2018.", original: "o", checkable: true },
    ]);
    const [c] = await extractClaims("The album was released in 2018.", ask, 5);
    expect(c.injected).toContain("Blackpink");
  });

  it("leaves injected undefined for a fully grounded claim", async () => {
    askJSON.mockResolvedValue([{ text: "CJNG seized the airport.", original: "o", checkable: true }]);
    const [c] = await extractClaims("CJNG seized the airport.", ask, 5);
    expect(c.injected).toBeUndefined();
  });
});
