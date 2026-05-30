/* eslint-disable react-hooks/refs */
// This hook keeps a deliberate cross-render cache (layout positions + node objects) in a ref and
// reads/writes it inside useMemo — the standard layout-memoization pattern for React Flow. It's
// safe because the cache is keyed by topology and node-identity reuse is purely an optimization:
// a render React discards (StrictMode double-invoke / concurrent) at worst yields a redundant
// re-render, never wrong output. The compute is deterministic and idempotent.
import { useMemo, useRef } from "react";
import type { Edge } from "@xyflow/react";
import type { FactGraph } from "@/lib/graph-types";
import {
  buildNodes,
  buildFlowEdges,
  computeLayout,
  positionNode,
  conflictEdges,
  type AppNode,
  type NodePosition,
} from "@/lib/graph-to-flow";

interface FlowCache {
  topology: string;
  positions: Map<string, NodePosition>;
  nodesById: Map<string, AppNode>;
}

/**
 * Derive React Flow nodes/edges from the streaming graph WITHOUT re-running dagre or rebuilding
 * every node on each tick. Two streaming facts make this safe:
 *   - applyEvent reuses the object reference of every item it doesn't touch, so an unchanged
 *     claim/question/evidence keeps a stable `data.item` identity across ticks.
 *   - Status/verdict/trace events (the frequent ones) change data but not topology.
 *
 * So we re-run the layout only when the node-id set changes (a real structural change), and we
 * reuse a node's prior object reference whenever its item AND position are unchanged. React Flow
 * then re-renders only the handful of cards that actually changed, instead of the whole scene.
 */
export function useGraphFlow(graph: FactGraph): { nodes: AppNode[]; edges: Edge[] } {
  const cache = useRef<FlowCache>({ topology: "", positions: new Map(), nodesById: new Map() });

  return useMemo(() => {
    const rawNodes = buildNodes(graph);
    const flowEdges = buildFlowEdges(graph);
    const edges = [...flowEdges, ...conflictEdges(graph)];

    // The node-id set fully determines the layout (every edge is derived from it). Data-only
    // events leave it untouched, so we skip dagre entirely on those ticks.
    const topology = rawNodes.map((n) => n.id).join("|");
    const c = cache.current;
    if (topology !== c.topology) {
      c.positions = computeLayout(rawNodes, flowEdges);
      c.topology = topology;
    }

    const prevById = c.nodesById;
    const nextById = new Map<string, AppNode>();
    const nodes = rawNodes.map((raw) => {
      const pos = c.positions.get(raw.id);
      const prev = prevById.get(raw.id);
      // Reuse the prior object (stable identity → no re-render) when nothing observable moved.
      if (
        prev &&
        prev.data.item === raw.data.item &&
        pos &&
        prev.position.x === pos.x &&
        prev.position.y === pos.y
      ) {
        nextById.set(raw.id, prev);
        return prev;
      }
      const built = positionNode(raw, pos);
      nextById.set(raw.id, built);
      return built;
    });
    c.nodesById = nextById;

    return { nodes, edges };
  }, [graph]);
}
