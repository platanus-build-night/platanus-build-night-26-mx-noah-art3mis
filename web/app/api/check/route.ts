import { runPipeline } from "@/lib/pipeline/run";

// The pipeline calls Anthropic + Exa, so it must run on the Node runtime and is
// inherently dynamic (never cached). It can take several seconds to fan out.
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

  try {
    const graph = await runPipeline(text.trim());
    return Response.json(graph);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Pipeline failed";
    console.error("[/api/check]", err);
    return Response.json({ error: message }, { status: 500 });
  }
}
