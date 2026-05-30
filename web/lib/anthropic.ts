import Anthropic from "@anthropic-ai/sdk";

// Server-side Anthropic client. ANTHROPIC_API_KEY is read from the environment
// by the SDK automatically; we construct lazily so importing this module in a
// non-configured context (e.g. the build step) doesn't throw.
let client: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }
    client = new Anthropic();
  }
  return client;
}

// Sonnet is the speed/quality balance for the per-claim reasoning calls; override
// via env if a run needs more (Opus) or less (Haiku). The whole pipeline fans out
// many of these in parallel, so latency per call matters.
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

/** Send a single prompt and return the concatenated text of the response. */
export async function askText(
  prompt: string,
  opts: { system?: string; maxTokens?: number } = {},
): Promise<string> {
  const msg = await anthropic().messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 1024,
    system: opts.system,
    messages: [{ role: "user", content: prompt }],
  });
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

/**
 * Ask for JSON and parse it. The model is instructed to return only JSON; we also
 * defensively extract the first balanced array/object in case it wraps prose or a
 * ```json fence around the payload.
 */
export async function askJSON<T>(
  prompt: string,
  opts: { system?: string; maxTokens?: number } = {},
): Promise<T> {
  const raw = await askText(prompt, opts);
  return parseJSON<T>(raw);
}

function parseJSON<T>(raw: string): T {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // Strip a ```json … ``` fence or surrounding prose, then grab the outermost
    // bracketed region.
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    const body = fenced ? fenced[1] : trimmed;
    const start = body.search(/[[{]/);
    const end = Math.max(body.lastIndexOf("]"), body.lastIndexOf("}"));
    if (start >= 0 && end > start) {
      return JSON.parse(body.slice(start, end + 1)) as T;
    }
    throw new Error(`Could not parse JSON from model output: ${raw.slice(0, 200)}`);
  }
}
