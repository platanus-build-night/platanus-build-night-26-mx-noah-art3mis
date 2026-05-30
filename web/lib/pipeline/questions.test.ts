import { describe, it, expect, vi, beforeEach } from "vitest";

const { askJSON } = vi.hoisted(() => ({ askJSON: vi.fn() }));
vi.mock("../anthropic", () => ({ askJSON }));

import { generateQuestions } from "./questions";
import type { ClaimItem } from "../graph-types";

function claim(over: Partial<ClaimItem> = {}): ClaimItem {
  return { id: "c1", text: "a claim", checkable: true, verdict: null, ...over };
}

beforeEach(() => askJSON.mockReset());

describe("generateQuestions", () => {
  it("returns no questions for an unckeckable claim and skips the model call entirely", async () => {
    const out = await generateQuestions(claim({ checkable: false }));
    expect(out).toEqual([]);
    expect(askJSON).not.toHaveBeenCalled();
  });

  it("namespaces question ids under the claim id", async () => {
    askJSON.mockResolvedValue(["q one?", "q two?"]);
    const out = await generateQuestions(claim({ id: "c2" }));
    expect(out.map((q) => q.id)).toEqual(["c2-q1", "c2-q2"]);
  });

  it("back-references the parent claim and starts each question pending", async () => {
    askJSON.mockResolvedValue(["q?"]);
    const [q] = await generateQuestions(claim({ id: "c7" }));
    expect(q.claimId).toBe("c7");
    expect(q.status).toBe("pending");
    expect(q.text).toBe("q?");
  });

  it("caps questions at two per claim", async () => {
    askJSON.mockResolvedValue(["a?", "b?", "c?", "d?"]);
    expect(await generateQuestions(claim())).toHaveLength(2);
  });

  it("includes the claim text in the prompt", async () => {
    askJSON.mockResolvedValue([]);
    await generateQuestions(claim({ text: "El Mencho died" }));
    expect(askJSON.mock.calls[0][0]).toContain("El Mencho died");
  });
});
