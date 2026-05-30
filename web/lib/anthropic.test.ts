import { describe, it, expect, vi, beforeEach } from "vitest";

const createMock = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class FakeAnthropic {
      messages = { create: createMock };
    },
  };
});

import { askText, askJSON } from "./anthropic";

beforeEach(() => {
  createMock.mockReset();
  process.env.ANTHROPIC_API_KEY = "test-key";
});

function reply(...blocks: Array<{ type: string; text?: string }>) {
  createMock.mockResolvedValue({ content: blocks });
}

describe("askText", () => {
  it("concatenates the text blocks of the response", async () => {
    reply({ type: "text", text: "Hello " }, { type: "text", text: "world" });
    expect(await askText("hi")).toBe("Hello world");
  });

  it("ignores non-text content blocks (e.g. tool_use)", async () => {
    reply(
      { type: "text", text: "keep" },
      { type: "tool_use" },
      { type: "text", text: "-this" },
    );
    expect(await askText("hi")).toBe("keep-this");
  });

  it("forwards the model, system prompt, and max_tokens to the SDK", async () => {
    reply({ type: "text", text: "ok" });
    await askText("the prompt", { system: "be terse", maxTokens: 256 });
    const args = createMock.mock.calls[0][0];
    expect(args.system).toBe("be terse");
    expect(args.max_tokens).toBe(256);
    expect(args.messages).toEqual([{ role: "user", content: "the prompt" }]);
  });

  it("defaults max_tokens when none is given", async () => {
    reply({ type: "text", text: "ok" });
    await askText("p");
    expect(createMock.mock.calls[0][0].max_tokens).toBe(1024);
  });
});

describe("askJSON parsing", () => {
  it("parses a bare JSON array", async () => {
    reply({ type: "text", text: '[{"a":1}]' });
    expect(await askJSON("p")).toEqual([{ a: 1 }]);
  });

  it("strips a ```json fenced code block", async () => {
    reply({ type: "text", text: '```json\n[{"a":1}]\n```' });
    expect(await askJSON("p")).toEqual([{ a: 1 }]);
  });

  it("strips an unlabeled ``` fence", async () => {
    reply({ type: "text", text: '```\n{"a":2}\n```' });
    expect(await askJSON("p")).toEqual({ a: 2 });
  });

  it("extracts the JSON payload from surrounding prose", async () => {
    reply({ type: "text", text: 'Here is the result: [{"a":1},{"a":2}] — hope that helps!' });
    expect(await askJSON("p")).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it("tolerates leading/trailing whitespace around clean JSON", async () => {
    reply({ type: "text", text: '   \n {"ok":true} \n  ' });
    expect(await askJSON("p")).toEqual({ ok: true });
  });

  it("throws an informative error when no JSON can be recovered", async () => {
    reply({ type: "text", text: "I could not complete that request." });
    await expect(askJSON("p")).rejects.toThrow(/Could not parse JSON/);
  });
});

describe("anthropic client configuration", () => {
  it("throws when ANTHROPIC_API_KEY is unset", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    vi.resetModules();
    const { askText: fresh } = await import("./anthropic");
    await expect(fresh("p")).rejects.toThrow(/ANTHROPIC_API_KEY/);
  });
});
