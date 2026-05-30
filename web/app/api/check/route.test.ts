import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PipelineEvent } from "@/lib/pipeline/events";

const { streamPipeline } = vi.hoisted(() => ({ streamPipeline: vi.fn() }));
vi.mock("@/lib/pipeline/stream", () => ({ streamPipeline }));

import { POST } from "./route";

function post(body: string): Request {
  return new Request("http://localhost/api/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

async function ndjson(res: Response): Promise<PipelineEvent[]> {
  const text = await res.text();
  return text
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
}

beforeEach(() => streamPipeline.mockReset());

describe("POST /api/check validation", () => {
  it("rejects a malformed JSON body with 400", async () => {
    const res = await POST(post("not json"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Invalid JSON/);
    expect(streamPipeline).not.toHaveBeenCalled();
  });

  it("rejects a missing text field with 400", async () => {
    const res = await POST(post(JSON.stringify({})));
    expect(res.status).toBe(400);
    expect(streamPipeline).not.toHaveBeenCalled();
  });

  it("rejects a non-string text field with 400", async () => {
    const res = await POST(post(JSON.stringify({ text: 42 })));
    expect(res.status).toBe(400);
  });

  it("rejects whitespace-only text with 400", async () => {
    const res = await POST(post(JSON.stringify({ text: "   " })));
    expect(res.status).toBe(400);
    expect(streamPipeline).not.toHaveBeenCalled();
  });
});

describe("POST /api/check streaming", () => {
  it("streams pipeline events as NDJSON with the right content type", async () => {
    streamPipeline.mockImplementation(async function* () {
      yield { type: "source", source: { id: "src", text: "hi", verdict: null } };
      yield { type: "done" };
    });

    const res = await POST(post(JSON.stringify({ text: "hi" })));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/x-ndjson");

    const events = await ndjson(res);
    expect(events.map((e) => e.type)).toEqual(["source", "done"]);
  });

  it("trims the source text before handing it to the pipeline", async () => {
    streamPipeline.mockImplementation(async function* () {
      yield { type: "done" };
    });
    await POST(post(JSON.stringify({ text: "  padded  " })));
    expect(streamPipeline).toHaveBeenCalledWith("padded");
  });

  it("converts a mid-stream pipeline failure into a terminal error event, not a crash", async () => {
    streamPipeline.mockImplementation(async function* () {
      yield { type: "source", source: { id: "src", text: "hi", verdict: null } };
      throw new Error("Exa exploded");
    });

    const res = await POST(post(JSON.stringify({ text: "hi" })));
    expect(res.status).toBe(200); // headers already flushed; failure rides the stream
    const events = await ndjson(res);
    expect(events[0].type).toBe("source");
    expect(events[events.length - 1]).toMatchObject({ type: "error", message: "Exa exploded" });
  });
});
