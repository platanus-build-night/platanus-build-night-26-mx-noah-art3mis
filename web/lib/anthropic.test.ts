import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RunConfig } from "./run-config";
import { THINKING_BUDGET } from "./run-config";

const createMock = vi.fn();
const ctorMock = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class FakeAnthropic {
      messages = { create: createMock };
      constructor(opts: unknown) {
        ctorMock(opts);
      }
    },
  };
});

import { createAnthropic } from "./anthropic";

const baseConfig: RunConfig = { model: "claude-sonnet-4-6", temperature: 0, thinking: false };

beforeEach(() => {
  createMock.mockReset();
  ctorMock.mockReset();
  process.env.ANTHROPIC_API_KEY = "env-key";
});

function reply(...blocks: Array<{ type: string; text?: string }>) {
  createMock.mockResolvedValue({ content: blocks });
}

function lastRequest() {
  return createMock.mock.calls[0][0];
}

describe("createAnthropic — askText response handling", () => {
  it("concatenates the text blocks of the response", async () => {
    reply({ type: "text", text: "Hello " }, { type: "text", text: "world" });
    expect(await createAnthropic(baseConfig).askText("hi")).toBe("Hello world");
  });

  it("ignores non-text content blocks (e.g. thinking, tool_use)", async () => {
    reply(
      { type: "thinking", text: "scratch" },
      { type: "text", text: "keep" },
      { type: "tool_use" },
      { type: "text", text: "-this" },
    );
    expect(await createAnthropic(baseConfig).askText("hi")).toBe("keep-this");
  });
});

describe("createAnthropic — request body", () => {
  it("forwards the model from config, plus system / max_tokens / messages", async () => {
    reply({ type: "text", text: "ok" });
    await createAnthropic({ ...baseConfig, model: "claude-opus-4-8" }).askText("the prompt", {
      system: "be terse",
      maxTokens: 256,
    });
    const args = lastRequest();
    expect(args.model).toBe("claude-opus-4-8");
    expect(args.system).toBe("be terse");
    expect(args.max_tokens).toBe(256);
    expect(args.messages).toEqual([{ role: "user", content: "the prompt" }]);
  });

  it("defaults max_tokens to 1024 when none is given (thinking off)", async () => {
    reply({ type: "text", text: "ok" });
    await createAnthropic(baseConfig).askText("p");
    expect(lastRequest().max_tokens).toBe(1024);
  });

  it("sends the configured temperature and no thinking block when thinking is off", async () => {
    reply({ type: "text", text: "ok" });
    await createAnthropic({ ...baseConfig, temperature: 0.4 }).askText("p");
    const args = lastRequest();
    expect(args.temperature).toBe(0.4);
    expect(args.thinking).toBeUndefined();
  });
});

describe("createAnthropic — extended thinking", () => {
  it("omits temperature and sends an enabled thinking block when thinking is on", async () => {
    reply({ type: "text", text: "ok" });
    await createAnthropic({ ...baseConfig, temperature: 0.4, thinking: true }).askText("p");
    const args = lastRequest();
    expect(args.temperature).toBeUndefined();
    expect(args.thinking).toEqual({ type: "enabled", budget_tokens: THINKING_BUDGET });
  });

  it("raises max_tokens above the thinking budget (API requires max_tokens > budget)", async () => {
    reply({ type: "text", text: "ok" });
    await createAnthropic({ ...baseConfig, thinking: true }).askText("p", { maxTokens: 600 });
    expect(lastRequest().max_tokens).toBe(THINKING_BUDGET + 600);
  });
});

describe("createAnthropic — API key resolution", () => {
  it("prefers the user-supplied key over the env key", async () => {
    reply({ type: "text", text: "ok" });
    await createAnthropic({ ...baseConfig, anthropicKey: "user-key" }).askText("p");
    expect(ctorMock).toHaveBeenCalledWith({ apiKey: "user-key" });
  });

  it("falls back to the env key when no user key is given", async () => {
    reply({ type: "text", text: "ok" });
    await createAnthropic(baseConfig).askText("p");
    expect(ctorMock).toHaveBeenCalledWith({ apiKey: "env-key" });
  });

  it("throws when neither a user key nor an env key is present", () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(() => createAnthropic(baseConfig)).toThrow(/ANTHROPIC_API_KEY/);
  });
});

describe("createAnthropic — askJSON parsing", () => {
  const ask = () => createAnthropic(baseConfig);

  it("parses a bare JSON array", async () => {
    reply({ type: "text", text: '[{"a":1}]' });
    expect(await ask().askJSON("p")).toEqual([{ a: 1 }]);
  });

  it("strips a ```json fenced code block", async () => {
    reply({ type: "text", text: '```json\n[{"a":1}]\n```' });
    expect(await ask().askJSON("p")).toEqual([{ a: 1 }]);
  });

  it("strips an unlabeled ``` fence", async () => {
    reply({ type: "text", text: '```\n{"a":2}\n```' });
    expect(await ask().askJSON("p")).toEqual({ a: 2 });
  });

  it("extracts the JSON payload from surrounding prose", async () => {
    reply({ type: "text", text: 'Here is the result: [{"a":1},{"a":2}] — hope that helps!' });
    expect(await ask().askJSON("p")).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it("tolerates leading/trailing whitespace around clean JSON", async () => {
    reply({ type: "text", text: '   \n {"ok":true} \n  ' });
    expect(await ask().askJSON("p")).toEqual({ ok: true });
  });

  it("throws an informative error when no JSON can be recovered", async () => {
    reply({ type: "text", text: "I could not complete that request." });
    await expect(ask().askJSON("p")).rejects.toThrow(/Could not parse JSON/);
  });
});
