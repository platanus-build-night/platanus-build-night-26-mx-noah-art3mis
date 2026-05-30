import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";
import type {
  FactGraph,
  SourceTextItem,
  ClaimItem,
  QuestionItem,
  EvidenceItem,
} from "./graph-types";
import { STANCE_META, VERDICT_META } from "./visuals";
import { isDeciding } from "./pipeline/verdict";

// Typed node aliases so each card component knows its data shape.
export type SourceNode = Node<{ item: SourceTextItem }, "source">;
export type ClaimNode = Node<{ item: ClaimItem }, "claim">;
export type QuestionNode = Node<{ item: QuestionItem }, "question">;
export type EvidenceNode = Node<{ item: EvidenceItem }, "evidence">;
export type AppNode = SourceNode | ClaimNode | QuestionNode | EvidenceNode;

// Approximate card sizes per layer — dagre needs these to space things; React Flow
// then renders the real DOM. Widths here must match the `width` we set on each node.
const SIZES: Record<AppNode["type"], { w: number; h: number }> = {
  source: { w: 380, h: 150 },
  claim: { w: 320, h: 160 },
  question: { w: 280, h: 80 },
  evidence: { w: 320, h: 210 },
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
      type: "smoothstep",
      animated: false,
      style: { stroke: "#2b3645", strokeWidth: 1.5 },
    });
  }

  for (const q of graph.questions) {
    nodes.push({ id: q.id, type: "question", position: { x: 0, y: 0 }, data: { item: q } });
    edges.push({
      id: `e-${q.claimId}-${q.id}`,
      source: q.claimId,
      target: q.id,
      type: "smoothstep",
      style: { stroke: "#1f6f78", strokeWidth: 1.5, strokeDasharray: "4 3" },
    });
  }

  for (const ev of graph.evidence) {
    nodes.push({ id: ev.id, type: "evidence", position: { x: 0, y: 0 }, data: { item: ev } });
    const stroke = STANCE_META[ev.stance].color;
    edges.push({
      id: `e-${ev.questionId}-${ev.id}`,
      source: ev.questionId,
      target: ev.id,
      type: "smoothstep",
      label: STANCE_META[ev.stance].label,
      animated: true,
      style: { stroke, strokeWidth: 2 },
      labelStyle: { fill: stroke, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" },
      labelBgStyle: { fill: "#0b0e15", fillOpacity: 0.9 },
      labelBgPadding: [5, 3],
      labelBgBorderRadius: 3,
    });
  }

  // Conflict overlay (CLUE): when one claim has both deciding support AND deciding
  // refutation, link the two strongest opposing sources so "Conflicting" means *these two
  // sources disagree*, not a flat label. Layout ranks on the structural edges only —
  // these same-rank evidence↔evidence links would otherwise distort the dagre layering.
  const laidOut = layout(nodes, edges);
  return { nodes: laidOut, edges: [...edges, ...conflictEdges(graph)] };
}

/** Edges between the strongest opposing deciding sources within each conflicting claim. */
export function conflictEdges(graph: FactGraph): Edge[] {
  const claimOfQuestion = new Map(graph.questions.map((q) => [q.id, q.claimId]));
  const byClaim = new Map<string, { supports: EvidenceItem[]; refutes: EvidenceItem[] }>();

  for (const ev of graph.evidence) {
    if (!isDeciding(ev)) continue;
    if (ev.stance !== "supports" && ev.stance !== "refutes") continue;
    const claimId = claimOfQuestion.get(ev.questionId);
    if (!claimId) continue;
    const bucket = byClaim.get(claimId) ?? { supports: [], refutes: [] };
    bucket[ev.stance].push(ev);
    byClaim.set(claimId, bucket);
  }

  const strongest = (items: EvidenceItem[]) =>
    items.reduce((best, e) => ((e.stanceConfidence ?? 0) > (best.stanceConfidence ?? 0) ? e : best));
  const color = VERDICT_META.conflicting.color;
  const edges: Edge[] = [];

  for (const [claimId, { supports, refutes }] of byClaim) {
    if (supports.length === 0 || refutes.length === 0) continue;
    const a = strongest(supports);
    const b = strongest(refutes);
    edges.push({
      id: `conflict-${claimId}`,
      source: a.id,
      target: b.id,
      // Evidence cards' left/right handles are target-only (leaves of the tree). Conflict
      // links join siblings in the same rank, so they ride dedicated top/bottom handles.
      sourceHandle: "conflict-out",
      targetHandle: "conflict-in",
      type: "smoothstep",
      animated: true,
      label: "conflicts",
      style: { stroke: color, strokeWidth: 1.5, strokeDasharray: "2 4" },
      labelStyle: { fill: color, fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" },
      labelBgStyle: { fill: "#0b0e15", fillOpacity: 0.9 },
      labelBgPadding: [4, 2],
      labelBgBorderRadius: 3,
      markerEnd: undefined,
      markerStart: undefined,
    });
  }

  return edges;
}

// Evidence ("sources") is the populous rank: in a pure LR layout every source under a
// question stacks into one column, so the graph's height grows with source count and fitView
// zooms everything down. We wrap each question's evidence into EV_COLS columns — dagre ranks a
// single virtual "row" node per chunk (so vertical spacing stays correct), then we expand each
// row into its side-by-side cards. Height scales with rows, not raw source count.
const EV_COLS = 4;
const EV_COL_GAP = 24;

function layout(nodes: AppNode[], edges: Edge[]): AppNode[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 26, ranksep: 96, marginx: 48, marginy: 48 });

  const evidenceIds = new Set(nodes.filter((n) => n.type === "evidence").map((n) => n.id));
  const nonEvidence = nodes.filter((n) => n.type !== "evidence");

  for (const n of nonEvidence) {
    const s = SIZES[n.type];
    g.setNode(n.id, { width: s.w, height: s.h });
  }
  // Structural edges only — question→evidence is replaced by question→row below.
  for (const e of edges) {
    if (evidenceIds.has(e.target)) continue;
    g.setEdge(e.source, e.target);
  }

  // Group evidence by question, then chunk into rows of EV_COLS. Each row is one dagre node.
  const evSize = SIZES.evidence;
  const rowWidth = evSize.w * EV_COLS + EV_COL_GAP * (EV_COLS - 1);
  const byQuestion = new Map<string, EvidenceNode[]>();
  for (const n of nodes) {
    if (n.type !== "evidence") continue;
    const qId = n.data.item.questionId;
    const bucket = byQuestion.get(qId) ?? [];
    bucket.push(n);
    byQuestion.set(qId, bucket);
  }
  const rows: { id: string; members: EvidenceNode[] }[] = [];
  for (const [qId, evs] of byQuestion) {
    for (let i = 0; i < evs.length; i += EV_COLS) {
      const id = `evrow-${qId}-${i / EV_COLS}`;
      rows.push({ id, members: evs.slice(i, i + EV_COLS) });
      g.setNode(id, { width: rowWidth, height: evSize.h });
      g.setEdge(qId, id);
    }
  }

  dagre.layout(g);

  const positioned = new Map<string, AppNode>();
  for (const n of nonEvidence) {
    const s = SIZES[n.type];
    const p = g.node(n.id);
    positioned.set(n.id, {
      ...n,
      position: { x: p.x - s.w / 2, y: p.y - s.h / 2 },
      width: s.w,
      style: { width: s.w },
    });
  }
  for (const row of rows) {
    const p = g.node(row.id);
    const left = p.x - rowWidth / 2;
    const top = p.y - evSize.h / 2;
    row.members.forEach((n, i) => {
      positioned.set(n.id, {
        ...n,
        position: { x: left + i * (evSize.w + EV_COL_GAP), y: top },
        width: evSize.w,
        style: { width: evSize.w },
      });
    });
  }

  return nodes.map((n) => positioned.get(n.id)!);
}
