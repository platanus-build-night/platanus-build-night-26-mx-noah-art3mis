// Per-run configuration for the VERITRACE pipeline. This is the single source of
// truth for which model runs, how deterministic it is (temperature), whether
// extended thinking is on, and which API keys to use. It is built once per request
// from the (untrusted) client body via parseConfig, then threaded down as `deps`.

// The models we expose in the UI. Sonnet is the default speed/quality balance for
// the per-claim reasoning calls; Opus for harder runs, Haiku for cheaper/faster.
export const MODELS = {
  "claude-opus-4-8": "Opus 4.8",
  "claude-sonnet-4-6": "Sonnet 4.6",
  "claude-haiku-4-5-20251001": "Haiku 4.5",
} as const;

export type ModelId = keyof typeof MODELS;

export const DEFAULT_MODEL: ModelId = "claude-sonnet-4-6";

// Extended-thinking budget. The API requires budget_tokens >= 1024 and
// max_tokens > budget_tokens; createAnthropic adds this on top of the per-call cap.
export const THINKING_BUDGET = 2048;

// How many atomic claims the extractor keeps. This is a legibility cap: the evidence
// graph grows as claims × questions × sources, so more claims means a denser, slower
// run. Surfaced and adjustable in the UI, but bounded server-side so a run stays
// readable and within the route's time budget.
export const MIN_CLAIMS = 1;
export const MAX_CLAIMS = 10;
export const DEFAULT_CLAIMS = 5;

export interface RunConfig {
  model: ModelId;
  /** 0..1. Lower = more deterministic. Ignored (forced to 1) when thinking is on. */
  temperature: number;
  thinking: boolean;
  /** Atomic claims the extractor keeps (MIN_CLAIMS..MAX_CLAIMS) — a legibility cap. */
  maxClaims: number;
  /** User-supplied key; blank ⇒ the server falls back to its ANTHROPIC_API_KEY env. */
  anthropicKey?: string;
  /** User-supplied key; blank ⇒ the server falls back to its EXA_API_KEY env. */
  exaKey?: string;
}

// Default to temperature 0 — deterministic output is the whole point of a
// fact-checking pipeline, and the reason runs were varying before.
export const DEFAULT_CONFIG: RunConfig = {
  model: DEFAULT_MODEL,
  temperature: 0,
  thinking: false,
  maxClaims: DEFAULT_CLAIMS,
};

function isModelId(value: unknown): value is ModelId {
  return typeof value === "string" && value in MODELS;
}

/** Trim a key string; treat blank/whitespace or non-string as absent (env fallback). */
function cleanKey(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Validate and coerce an untrusted request body into a RunConfig. Missing fields fall
 * back to DEFAULT_CONFIG. Throws on a hard-invalid model or out-of-range temperature so
 * the API route can answer 400 rather than forwarding garbage to the model.
 */
export function parseConfig(input: unknown): RunConfig {
  if (input == null) return { ...DEFAULT_CONFIG };
  if (typeof input !== "object") {
    throw new Error("config must be an object");
  }
  const raw = input as Record<string, unknown>;

  let model: ModelId = DEFAULT_MODEL;
  if (raw.model !== undefined) {
    if (!isModelId(raw.model)) throw new Error(`Unknown model: ${String(raw.model)}`);
    model = raw.model;
  }

  let temperature = DEFAULT_CONFIG.temperature;
  if (raw.temperature !== undefined) {
    const t = raw.temperature;
    if (typeof t !== "number" || Number.isNaN(t) || t < 0 || t > 1) {
      throw new Error("temperature must be a number between 0 and 1");
    }
    temperature = t;
  }

  let maxClaims = DEFAULT_CONFIG.maxClaims;
  if (raw.maxClaims !== undefined) {
    const m = raw.maxClaims;
    if (typeof m !== "number" || !Number.isInteger(m) || m < MIN_CLAIMS || m > MAX_CLAIMS) {
      throw new Error(`maxClaims must be an integer between ${MIN_CLAIMS} and ${MAX_CLAIMS}`);
    }
    maxClaims = m;
  }

  return {
    model,
    temperature,
    thinking: Boolean(raw.thinking),
    maxClaims,
    anthropicKey: cleanKey(raw.anthropicKey),
    exaKey: cleanKey(raw.exaKey),
  };
}
