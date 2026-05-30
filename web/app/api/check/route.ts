import { streamPipeline } from "@/lib/pipeline/stream";

// The pipeline calls Anthropic + Exa, so it must run on the Node runtime and is
// inherently dynamic (never cached). It streams events as NDJSON so the client can
// build the evidence graph live.
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  let text: unknown;
  try {
    ({ text } = await request.json());
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof text !== "string" || text.trim().length === 0) {
    return Response.json({ error: "Body must include non-empty 'text'." }, { status: 400 });
  }
  const source = text.trim();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        for await (const event of streamPipeline(source)) send(event);
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
