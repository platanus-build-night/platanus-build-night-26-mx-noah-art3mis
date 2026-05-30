import { describe, it, expect } from "vitest";
import { parseConfig, DEFAULT_CONFIG, DEFAULT_MODEL } from "./run-config";

describe("parseConfig defaults", () => {
  it("returns the default config when input is undefined", () => {
    expect(parseConfig(undefined)).toEqual(DEFAULT_CONFIG);
  });

  it("returns the default config when input is null", () => {
    expect(parseConfig(null)).toEqual(DEFAULT_CONFIG);
  });

  it("defaults temperature to 0 — the deterministic setting", () => {
    expect(parseConfig({ model: DEFAULT_MODEL }).temperature).toBe(0);
  });

  it("defaults thinking to false", () => {
    expect(parseConfig({}).thinking).toBe(false);
  });
});

describe("parseConfig validation", () => {
  it("accepts a whitelisted model", () => {
    expect(parseConfig({ model: "claude-opus-4-8" }).model).toBe("claude-opus-4-8");
  });

  it("rejects an unknown model", () => {
    expect(() => parseConfig({ model: "gpt-4" })).toThrow(/model/i);
  });

  it("accepts a temperature within range", () => {
    expect(parseConfig({ temperature: 0.7 }).temperature).toBe(0.7);
  });

  it("rejects a temperature above 1", () => {
    expect(() => parseConfig({ temperature: 1.5 })).toThrow(/temperature/i);
  });

  it("rejects a temperature below 0", () => {
    expect(() => parseConfig({ temperature: -0.1 })).toThrow(/temperature/i);
  });

  it("rejects a non-numeric temperature", () => {
    expect(() => parseConfig({ temperature: "hot" })).toThrow(/temperature/i);
  });

  it("coerces thinking to a boolean", () => {
    expect(parseConfig({ thinking: true }).thinking).toBe(true);
  });
});

describe("parseConfig maxClaims", () => {
  it("defaults maxClaims to 5", () => {
    expect(parseConfig({}).maxClaims).toBe(5);
  });

  it("accepts an in-range integer maxClaims", () => {
    expect(parseConfig({ maxClaims: 8 }).maxClaims).toBe(8);
  });

  it("rejects maxClaims below the minimum", () => {
    expect(() => parseConfig({ maxClaims: 0 })).toThrow(/claim/i);
  });

  it("rejects maxClaims above the maximum", () => {
    expect(() => parseConfig({ maxClaims: 11 })).toThrow(/claim/i);
  });

  it("rejects a non-integer maxClaims", () => {
    expect(() => parseConfig({ maxClaims: 3.5 })).toThrow(/claim/i);
  });
});

describe("parseConfig API keys", () => {
  it("passes through non-empty trimmed keys", () => {
    const cfg = parseConfig({ anthropicKey: "  sk-ant-123  ", exaKey: "exa-456" });
    expect(cfg.anthropicKey).toBe("sk-ant-123");
    expect(cfg.exaKey).toBe("exa-456");
  });

  it("treats blank/whitespace keys as absent (env fallback)", () => {
    const cfg = parseConfig({ anthropicKey: "   ", exaKey: "" });
    expect(cfg.anthropicKey).toBeUndefined();
    expect(cfg.exaKey).toBeUndefined();
  });

  it("ignores non-string keys", () => {
    const cfg = parseConfig({ anthropicKey: 42 });
    expect(cfg.anthropicKey).toBeUndefined();
  });
});
