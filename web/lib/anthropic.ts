import Anthropic from "@anthropic-ai/sdk";
import { THINKING_BUDGET, type RunConfig } from "./run-config";

// Per-request Anthropic access. createAnthropic binds the model, temperature, thinking
// setting, and API key from one RunConfig, so the whole pipeline can fan out many calls
// that all share the same run configuration without touching module globals.

export interface AskOpts {
  system?: string;
  maxTokens?: number;
}

export interface AnthropicCaller {
  /** Send a single prompt and return the concatenated text of the response. */
  askText(prompt: string, opts?: AskOpts): Promise<string>;
  /** Ask for JSON and parse it (tolerating fences / surrounding prose). */
  askJSON<T>(prompt: string, opts?: AskOpts): Promise<T>;
}

export function createAnthropic(config: RunConfig): AnthropicCaller {
  const apiKey = config.anthropicKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set (and no key was provided)");
  }
  const client = new Anthropic({ apiKey });

  async function askText(prompt: string, opts: AskOpts = {}): Promise<string> {
    const maxTokens = opts.maxTokens ?? 1024;

    // Extended thinking and temperature are mutually exclusive: the API requires
    // temperature unset (i.e. 1) when thinking is enabled, and max_tokens must exceed
    // the thinking budget, so we add the budget on top of the per-call cap.
    const params: Anthropic.MessageCreateParamsNonStreaming = config.thinking
      ? {
          model: config.model,
          max_tokens: THINKING_BUDGET + maxTokens,
          thinking: { type: "enabled", budget_tokens: THINKING_BUDGET },
          system: opts.system,
          messages: [{ role: "user", content: prompt }],
        }
      : {
          model: config.model,
          max_tokens: maxTokens,
          temperature: config.temperature,
          system: opts.system,
          messages: [{ role: "user", content: prompt }],
        };

    const msg = await client.messages.create(params);
    return msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
  }

  async function askJSON<T>(prompt: string, opts: AskOpts = {}): Promise<T> {
    return parseJSON<T>(await askText(prompt, opts));
  }

  return { askText, askJSON };
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
