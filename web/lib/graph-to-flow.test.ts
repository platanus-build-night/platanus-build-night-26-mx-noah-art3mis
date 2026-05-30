import { describe, it, expect } from "vitest";
import { graphToFlow } from "./graph-to-flow";
import type { FactGraph } from "./graph-types";
import { STANCE_META } from "./visuals";

function graph(): FactGraph {
  return {
    source: { id: "src", text: "post", verdict: "conflicting" },
    claims: [
      { id: "c1", text: "c1", checkable: true, verdict: "supported" },
      { id: "c2", text: "c2", checkable: true, verdict: "refuted" },
    ],
    questions: [
      { id: "c1-q1", claimId: "c1", text: "q?", status: "answered" },
      { id: "c2-q1", claimId: "c2", text: "q?", status: "answered" },
    ],
    evidence: [
      {
        id: "c1-q1-e1",
        questionId: "c1-q1",
        title: "t",
        url: "https://bbc.com/x",
        domain: "bbc.com",
        passage: "p",
        stance: "supports",
        reliability: "high",
        sourceType: "primary",
        stanceConfidence: 0.9,
      },
      {
        id: "c2-q1-e1",
        questionId: "c2-q1",
        title: "t",
        url: "https://proceso.com.mx/x",
        domain: "proceso.com.mx",
        passage: "p",
        stance: "refutes",
        reliability: "high",
        sourceType: "primary",
        stanceConfidence: 0.9,
      },
    ],
  };
}

describe("graphToFlow nodes", () => {
  it("produces one node per graph item across all four layers", () => {
    const { nodes } = graphToFlow(graph());
    // 1 source + 2 claims + 2 questions + 2 evidence
    expect(nodes).toHaveLength(7);
  });

  it("tags each node with the layer type matching its id", () => {
    const { nodes } = graphToFlow(graph());
    const typeById = Object.fromEntries(nodes.map((n) => [n.id, n.type]));
    expect(typeById["src"]).toBe("source");
    expect(typeById["c1"]).toBe("claim");
    expect(typeById["c1-q1"]).toBe("question");
    expect(typeById["c1-q1-e1"]).toBe("evidence");
  });

  it("assigns each node a layout width and a finite position", () => {
    const { nodes } = graphToFlow(graph());
    for (const n of nodes) {
      expect(n.width).toBeGreaterThan(0);
      expect(Number.isFinite(n.position.x)).toBe(true);
      expect(Number.isFinite(n.position.y)).toBe(true);
    }
  });

  it("lays claims out to the right of the source (rankdir LR)", () => {
    const { nodes } = graphToFlow(graph());
    const src = nodes.find((n) => n.id === "src")!;
    const c1 = nodes.find((n) => n.id === "c1")!;
    expect(c1.position.x).toBeGreaterThan(src.position.x);
  });
});

describe("graphToFlow edges", () => {
  it("wires source→claim, claim→question, and question→evidence", () => {
    const { edges } = graphToFlow(graph());
    const pairs = edges.map((e) => `${e.source}->${e.target}`);
    expect(pairs).toContain("src->c1");
    expect(pairs).toContain("c1->c1-q1");
    expect(pairs).toContain("c1-q1->c1-q1-e1");
  });

  it("creates exactly one edge per non-root node", () => {
    const { nodes, edges } = graphToFlow(graph());
    // every node except the root source has exactly one incoming edge
    expect(edges).toHaveLength(nodes.length - 1);
  });

  it("gives each edge a unique id", () => {
    const { edges } = graphToFlow(graph());
    expect(new Set(edges.map((e) => e.id)).size).toBe(edges.length);
  });

  it("colors and labels evidence edges by stance", () => {
    const { edges } = graphToFlow(graph());
    const supportEdge = edges.find((e) => e.target === "c1-q1-e1")!;
    const refuteEdge = edges.find((e) => e.target === "c2-q1-e1")!;
    expect(supportEdge.label).toBe(STANCE_META.supports.label);
    expect(supportEdge.style?.stroke).toBe(STANCE_META.supports.color);
    expect(refuteEdge.label).toBe(STANCE_META.refutes.label);
    expect(refuteEdge.style?.stroke).toBe(STANCE_META.refutes.color);
  });

  it("animates evidence edges but not structural source→claim edges", () => {
    const { edges } = graphToFlow(graph());
    expect(edges.find((e) => e.target === "c1-q1-e1")!.animated).toBe(true);
    expect(edges.find((e) => e.target === "c1")!.animated).toBe(false);
  });
});

describe("graphToFlow degenerate inputs", () => {
  it("handles a source-only graph (no claims yet) — the start of a live build", () => {
    const { nodes, edges } = graphToFlow({
      source: { id: "src", text: "post", verdict: null },
      claims: [],
      questions: [],
      evidence: [],
    });
    expect(nodes).toHaveLength(1);
    expect(edges).toHaveLength(0);
  });
});
