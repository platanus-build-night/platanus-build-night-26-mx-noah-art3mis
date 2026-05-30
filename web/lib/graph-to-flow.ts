import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";
import type {
  FactGraph,
  SourceTextItem,
  ClaimItem,
  QuestionItem,
  EvidenceItem,
} from "./graph-types";
import { STANCE_META } from "./visuals";

// Typed node aliases so each card component knows its data shape.
export type SourceNode = Node<{ item: SourceTextItem }, "source">;
export type ClaimNode = Node<{ item: ClaimItem }, "claim">;
export type QuestionNode = Node<{ item: QuestionItem }, "question">;
export type EvidenceNode = Node<{ item: EvidenceItem }, "evidence">;
export type AppNode = SourceNode | ClaimNode | QuestionNode | EvidenceNode;

// Approximate card sizes per layer — dagre needs these to space things; React Flow
// then renders the real DOM. Widths here must match the `width` we set on each node.
const SIZES: Record<AppNode["type"], { w: number; h: number }> = {
  source: { w: 380, h: 170 },
  claim: { w: 320, h: 150 },
  question: { w: 280, h: 90 },
  evidence: { w: 320, h: 180 },
};

export function graphToFlow(graph: FactGraph): { nodes: AppNode[]; edges: Edge[] } {
  const nodes: AppNode[] = [];
  const edges: Edge[] = [];

  nodes.push({ id: graph.source.id, type: "source", position: { x: 0, y: 0 }, data: { item: graph.source } });

  for (const claim of graph.claims) {
    nodes.push({ id: claim.id, type: "claim", position: { x: 0, y: 0 }, data: { item: claim } });
    edges.push({
      id: `e-${graph.source.id}-${claim.id}`,
      source: graph.source.id,
      target: claim.id,
      animated: false,
      style: { stroke: "#475569", strokeWidth: 1.5 },
    });
  }

  for (const q of graph.questions) {
    nodes.push({ id: q.id, type: "question", position: { x: 0, y: 0 }, data: { item: q } });
    edges.push({
      id: `e-${q.claimId}-${q.id}`,
      source: q.claimId,
      target: q.id,
      style: { stroke: "#475569", strokeWidth: 1.5, strokeDasharray: "4 3" },
    });
  }

  for (const ev of graph.evidence) {
    nodes.push({ id: ev.id, type: "evidence", position: { x: 0, y: 0 }, data: { item: ev } });
    const stroke = STANCE_META[ev.stance].stroke;
    edges.push({
      id: `e-${ev.questionId}-${ev.id}`,
      source: ev.questionId,
      target: ev.id,
      label: STANCE_META[ev.stance].label,
      animated: true,
      style: { stroke, strokeWidth: 2 },
      labelStyle: { fill: stroke, fontSize: 11, fontWeight: 600 },
      labelBgStyle: { fill: "#0b0f17" },
    });
  }

  return { nodes: layout(nodes, edges), edges };
}

function layout(nodes: AppNode[], edges: Edge[]): AppNode[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 26, ranksep: 96, marginx: 48, marginy: 48 });

  for (const n of nodes) {
    const s = SIZES[n.type];
    g.setNode(n.id, { width: s.w, height: s.h });
  }
  for (const e of edges) g.setEdge(e.source, e.target);

  dagre.layout(g);

  return nodes.map((n) => {
    const s = SIZES[n.type];
    const p = g.node(n.id);
    return {
      ...n,
      position: { x: p.x - s.w / 2, y: p.y - s.h / 2 },
      width: s.w,
      style: { width: s.w },
    };
  });
}
