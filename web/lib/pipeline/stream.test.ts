import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ClaimItem, QuestionItem, EvidenceItem, Stance } from "../graph-types";
import type { PipelineEvent } from "./events";

// Mock the leaf stages (LLM/search) but keep the deterministic verdict + rationale
// logic real — we are testing the ORCHESTRATION: event order, parallel fan-out, and
// per-claim verdict resolution as the last question lands.
const { extractClaims, generateQuestions, resolveQuestion } = vi.hoisted(() => ({
  extractClaims: vi.fn(),
  generateQuestions: vi.fn(),
  resolveQuestion: vi.fn(),
}));

vi.mock("./extract", () => ({ extractClaims }));
vi.mock("./questions", () => ({ generateQuestions }));
vi.mock("./resolve", async () => {
  const actual = await vi.importActual<typeof import("./resolve")>("./resolve");
  return { ...actual, resolveQuestion };
});

import { streamPipeline, collectGraph } from "./stream";
import type { PipelineDeps } from "./deps";

// The leaf stages are mocked, so deps is inert here — a placeholder satisfies the type.
const deps = { ask: { askJSON: vi.fn(), askText: vi.fn() }, search: vi.fn() } as PipelineDeps;

let evCounter = 0;
function evidence(questionId: string, stance: Stance): EvidenceItem {
  return {
    id: `${questionId}-e${evCounter++}`,
    questionId,
    title: "t",
    url: "https://bbc.com/x",
    domain: "bbc.com",
    passage: "p",
    stance,
    reliability: "high",
    sourceType: "primary",
    stanceConfidence: 0.9,
  };
}

function claim(id: string, checkable = true): ClaimItem {
  return { id, text: `claim ${id}`, checkable, verdict: null };
}

function question(claimId: string, n: number): QuestionItem {
  return { id: `${claimId}-q${n}`, claimId, text: "q?", status: "pending" };
}

beforeEach(() => {
  extractClaims.mockReset();
  generateQuestions.mockReset();
  resolveQuestion.mockReset();
  evCounter = 0;
});

async function drain(text: string): Promise<PipelineEvent[]> {
  const out: PipelineEvent[] = [];
  for await (const ev of streamPipeline(text, deps)) out.push(ev);
  return out;
}

describe("streamPipeline event protocol", () => {
  beforeEach(() => {
    extractClaims.mockResolvedValue([claim("c1")]);
    generateQuestions.mockImplementation(async (c: ClaimItem) => [question(c.id, 1)]);
    resolveQuestion.mockResolvedValue([evidence("c1-q1", "supports")]);
  });

  it("emits source first and done last", async () => {
    const events = await drain("post");
    expect(events[0].type).toBe("source");
    expect(events[events.length - 1].type).toBe("done");
  });

  it("emits the source verdict exactly once, just before done", async () => {
    const events = await drain("post");
    const verdicts = events.filter((e) => e.type === "source_verdict");
    expect(verdicts).toHaveLength(1);
    expect(events[events.length - 2].type).toBe("source_verdict");
  });

  it("emits each claim before any question, and questions before evidence", async () => {
    const events = await drain("post");
    const t = events.map((e) => e.type);
    expect(t.indexOf("claim")).toBeLessThan(t.indexOf("question"));
    expect(t.indexOf("question")).toBeLessThan(t.indexOf("evidence"));
  });

  it("moves each question through searching then answered", async () => {
    const events = await drain("post");
    const statuses = events
      .filter((e): e is Extract<PipelineEvent, { type: "question_status" }> => e.type === "question_status")
      .map((e) => e.status);
    expect(statuses).toEqual(["searching", "answered"]);
  });
});

describe("streamPipeline verdict resolution", () => {
  it("resolves a claim verdict only after its last question is answered", async () => {
    extractClaims.mockResolvedValue([claim("c1")]);
    generateQuestions.mockResolvedValue([question("c1", 1), question("c1", 2)]);
    resolveQuestion.mockImplementation(async (_c: ClaimItem, q: QuestionItem) => [
      evidence(q.id, "supports"),
    ]);

    const events = await drain("post");
    const answeredCount = events.filter(
      (e) => e.type === "question_status" && e.status === "answered",
    ).length;
    const verdictIdx = events.findIndex((e) => e.type === "claim_verdict");
    const secondAnsweredIdx = events.reduce(
      (acc, e, i) =>
        e.type === "question_status" && e.status === "answered" ? i : acc,
      -1,
    );
    expect(answeredCount).toBe(2);
    expect(verdictIdx).toBeGreaterThan(secondAnsweredIdx);
  });

  it("immediately resolves an unckeckable (question-less) claim to nei without retrieval", async () => {
    extractClaims.mockResolvedValue([claim("c1", false)]);
    generateQuestions.mockResolvedValue([]); // mirrors the real short-circuit
    const events = await drain("post");

    expect(resolveQuestion).not.toHaveBeenCalled();
    const verdict = events.find((e) => e.type === "claim_verdict");
    expect(verdict).toMatchObject({ id: "c1", verdict: "nei" });
  });
});

describe("collectGraph", () => {
  it("drains the stream into a finished graph with a supported claim and verdict", async () => {
    extractClaims.mockResolvedValue([claim("c1")]);
    generateQuestions.mockResolvedValue([question("c1", 1)]);
    resolveQuestion.mockResolvedValue([evidence("c1-q1", "supports")]);

    const graph = await collectGraph("post", deps);
    expect(graph.source.text).toBe("post");
    expect(graph.claims[0].verdict).toBe("supported");
    expect(graph.claims[0].rationale).toMatch(/Supported by/);
    expect(graph.questions.every((q) => q.status === "answered")).toBe(true);
    expect(graph.source.verdict).toBe("supported");
  });

  it("aggregates a mixed support+refute document to conflicting end-to-end", async () => {
    // One claim whose two questions return opposing evidence → claim conflicting → source conflicting.
    extractClaims.mockResolvedValue([claim("c1")]);
    generateQuestions.mockResolvedValue([question("c1", 1), question("c1", 2)]);
    resolveQuestion.mockImplementation(async (_c: ClaimItem, q: QuestionItem) => [
      evidence(q.id, q.id.endsWith("q1") ? "supports" : "refutes"),
    ]);

    const graph = await collectGraph("post", deps);
    expect(graph.claims[0].verdict).toBe("conflicting");
    expect(graph.source.verdict).toBe("conflicting");
  });

  it("keeps an unverifiable claim as nei while the document resolves on its checkable claims", async () => {
    extractClaims.mockResolvedValue([claim("c1", true), claim("c2", false)]);
    generateQuestions.mockImplementation(async (c: ClaimItem) =>
      c.checkable ? [question(c.id, 1)] : [],
    );
    resolveQuestion.mockResolvedValue([evidence("c1-q1", "refutes")]);

    const graph = await collectGraph("post", deps);
    const c1 = graph.claims.find((c) => c.id === "c1")!;
    const c2 = graph.claims.find((c) => c.id === "c2")!;
    expect(c1.verdict).toBe("refuted");
    expect(c2.verdict).toBe("nei");
    expect(graph.source.verdict).toBe("refuted"); // nei excluded from the aggregate
  });
});
