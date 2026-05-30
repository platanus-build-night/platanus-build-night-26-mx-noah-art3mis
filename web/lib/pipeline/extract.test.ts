import { describe, it, expect, vi, beforeEach } from "vitest";

const { askJSON } = vi.hoisted(() => ({ askJSON: vi.fn() }));
vi.mock("../anthropic", () => ({ askJSON }));

import { extractClaims } from "./extract";

beforeEach(() => askJSON.mockReset());

describe("extractClaims", () => {
  it("assigns sequential c1/c2 ids and starts every claim with a null verdict", async () => {
    askJSON.mockResolvedValue([
      { text: "claim one", original: "frag1", checkable: true },
      { text: "claim two", original: "frag2", checkable: true },
    ]);
    const claims = await extractClaims("source");
    expect(claims.map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(claims.every((c) => c.verdict === null)).toBe(true);
  });

  it("preserves the decontextualized text and the original fragment", async () => {
    askJSON.mockResolvedValue([{ text: "decontextualized", original: "raw bit", checkable: true }]);
    const [c] = await extractClaims("source");
    expect(c.text).toBe("decontextualized");
    expect(c.original).toBe("raw bit");
  });

  it("caps extraction at three claims even if the model returns more", async () => {
    askJSON.mockResolvedValue(
      Array.from({ length: 6 }, (_, i) => ({ text: `c${i}`, original: "o", checkable: true })),
    );
    expect(await extractClaims("source")).toHaveLength(3);
  });

  it("marks a claim uncheckable only when the model explicitly says false", async () => {
    askJSON.mockResolvedValue([{ text: "media claim", original: "o", checkable: false }]);
    const [c] = await extractClaims("source");
    expect(c.checkable).toBe(false);
  });

  it("defaults checkable to true when the model omits the field", async () => {
    askJSON.mockResolvedValue([{ text: "c", original: "o" }]);
    const [c] = await extractClaims("source");
    expect(c.checkable).toBe(true);
  });

  it("embeds the source text in the user prompt", async () => {
    askJSON.mockResolvedValue([]);
    await extractClaims("THE VIRAL POST");
    expect(askJSON.mock.calls[0][0]).toContain("THE VIRAL POST");
  });
});
