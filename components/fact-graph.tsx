"use client";

import { useEffect } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useReactFlow,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { nodeTypes, InternalsContext } from "./graph-nodes";
import { useGraphFlow } from "./use-graph-flow";
import type { FactGraph } from "@/lib/graph-types";

const MINIMAP_COLOR: Record<string, string> = {
  source: "#5b6678",
  claim: "#97a2b4",
  question: "#3ad6e6",
  evidence: "#34d399",
};

// Past this many nodes the MiniMap (one SVG rect per node) costs more than it helps — the
// thumbnail is an unreadable speckle anyway — so we drop it rather than re-render it per tick.
const MINIMAP_MAX_NODES = 220;

// Keep the whole graph in frame as nodes stream in. Trailing-debounced: a burst of evidence
// landing together triggers ONE fitView after it settles, not an overlapping animation per node.
function FitOnGrow({ count }: { count: number }) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    const t = setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 300);
    return () => clearTimeout(t);
  }, [count, fitView]);
  return null;
}

export default function FactGraphCanvas({
  graph,
  showInternals = false,
}: {
  graph: FactGraph;
  showInternals?: boolean;
}) {
  // Cached derive: re-runs dagre only on topology changes and keeps stable node identities so
  // React Flow re-renders just the cards that changed (see useGraphFlow).
  const { nodes, edges } = useGraphFlow(graph);

  return (
    <InternalsContext.Provider value={showInternals}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.2}
        maxZoom={1.5}
        onlyRenderVisibleElements
        proOptions={{ hideAttribution: true }}
        className="bg-transparent"
      >
        <FitOnGrow count={nodes.length} />
        <Background variant={BackgroundVariant.Cross} gap={36} size={4} color="#18202c" />
        <Controls
          showInteractive={false}
          className="!overflow-hidden !rounded-md !border !border-[var(--line)] !shadow-xl [&_button]:!border-[var(--line)] [&_button]:!bg-[var(--panel-2)] [&_button]:!fill-[var(--ink-2)] [&_button:hover]:!bg-[var(--line)]"
        />
        {nodes.length <= MINIMAP_MAX_NODES && (
          <MiniMap
            pannable
            zoomable
            nodeColor={(n: Node) => MINIMAP_COLOR[n.type ?? "source"] ?? "#5b6678"}
            nodeStrokeWidth={0}
            maskColor="rgba(8,10,15,0.78)"
            className="!rounded-md !border !border-[var(--line)] !bg-[var(--bg-2)]"
            style={{ width: 168, height: 112 }}
          />
        )}
      </ReactFlow>
    </InternalsContext.Provider>
  );
}
