import { streamPipeline } from "@/lib/pipeline/stream";
import { createAnthropic } from "@/lib/anthropic";
import { createExaSearch } from "@/lib/exa";
import { parseConfig } from "@/lib/run-config";

// The pipeline calls Anthropic + Exa, so it must run on the Node runtime and is
// inherently dynamic (never cached). It streams events as NDJSON so the client can
// build the evidence graph live. The request body carries both the source text and a
// per-run config (model / temperature / thinking / optional user API keys).
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: { text?: unknown; config?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { text } = body;
  if (typeof text !== "string" || text.trim().length === 0) {
    return Response.json({ error: "Body must include non-empty 'text'." }, { status: 400 });
  }
  const source = text.trim();

  // Validate the run config and build the per-request deps. A bad model/temperature or a
  // missing API key (no user key and no server env fallback) is a 400 with a clear message,
  // surfaced before we open the stream.
  let deps;
  try {
    const config = parseConfig(body.config);
    deps = {
      ask: createAnthropic(config),
      search: createExaSearch(config.exaKey),
      maxClaims: config.maxClaims,
    };
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Invalid run configuration" },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        for await (const event of streamPipeline(source, deps)) send(event);
      } catch (err) {
        console.error("[/api/check]", err);
        send({ type: "error", message: err instanceof Error ? err.message : "Pipeline failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
