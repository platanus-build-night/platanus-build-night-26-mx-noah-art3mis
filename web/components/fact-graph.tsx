"use client";

import { useEffect, useMemo } from "react";
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
import { nodeTypes } from "./graph-nodes";
import { graphToFlow } from "@/lib/graph-to-flow";
import type { FactGraph } from "@/lib/graph-types";

const MINIMAP_COLOR: Record<string, string> = {
  source: "#5b6678",
  claim: "#97a2b4",
  question: "#3ad6e6",
  evidence: "#34d399",
};

// Keep the whole graph in frame as nodes stream in during the live build.
function FitOnGrow({ count }: { count: number }) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    fitView({ padding: 0.15, duration: 400 });
  }, [count, fitView]);
  return null;
}

export default function FactGraphCanvas({ graph }: { graph: FactGraph }) {
  const { nodes, edges } = useMemo(() => graphToFlow(graph), [graph]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.15 }}
      minZoom={0.2}
      maxZoom={1.5}
      proOptions={{ hideAttribution: true }}
      className="bg-transparent"
    >
      <FitOnGrow count={nodes.length} />
      <Background variant={BackgroundVariant.Cross} gap={36} size={4} color="#18202c" />
      <Controls
        showInteractive={false}
        className="!overflow-hidden !rounded-md !border !border-[var(--line)] !shadow-xl [&_button]:!border-[var(--line)] [&_button]:!bg-[var(--panel-2)] [&_button]:!fill-[var(--ink-2)] [&_button:hover]:!bg-[var(--line)]"
      />
      <MiniMap
        pannable
        zoomable
        nodeColor={(n: Node) => MINIMAP_COLOR[n.type ?? "source"] ?? "#5b6678"}
        nodeStrokeWidth={0}
        maskColor="rgba(8,10,15,0.78)"
        className="!rounded-md !border !border-[var(--line)] !bg-[var(--bg-2)]"
        style={{ width: 168, height: 112 }}
      />
    </ReactFlow>
  );
}
