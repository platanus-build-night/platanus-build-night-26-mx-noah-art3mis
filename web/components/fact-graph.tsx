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
  source: "#64748b",
  claim: "#94a3b8",
  question: "#38bdf8",
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
      <Background variant={BackgroundVariant.Dots} gap={28} size={1} color="#1e293b" />
      <Controls className="!border-slate-700 !bg-slate-800 [&_button]:!border-slate-700 [&_button]:!bg-slate-800 [&_button]:!fill-slate-300" />
      <MiniMap
        pannable
        zoomable
        nodeColor={(n: Node) => MINIMAP_COLOR[n.type ?? "source"] ?? "#64748b"}
        maskColor="rgba(2,6,23,0.7)"
        className="!bg-slate-900"
      />
    </ReactFlow>
  );
}
