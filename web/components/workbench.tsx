"use client";

import { useState } from "react";
import FactGraphCanvas from "./fact-graph";
import { MOCK_GRAPH } from "@/lib/mock-graph";
import type { FactGraph } from "@/lib/graph-types";
import type { PipelineEvent } from "@/lib/pipeline/events";
import { applyEvent, emptyGraph } from "@/lib/apply-event";

// Curated demo posts (real viral misinformation, text-native) — see demo-corpus/SOURCES.md.
// The El Mencho story is the de-novo hero; the others give textured mixed-verdict graphs.
const EXAMPLES: { label: string; text: string }[] = [
  {
    label: "El Mencho · GDL airport",
    text:
      "ÚLTIMA HORA: Tras la muerte de 'El Mencho' el 22 de febrero, comandos armados del CJNG tomaron por asalto el Aeropuerto Internacional de Guadalajara y mantienen como rehenes a turistas estadounidenses. Mientras tanto, Puerto Vallarta arde en llamas.",
  },
  {
    label: "Venezuela · post-Maduro",
    text:
      "VÍDEO: venezolanos salen a las calles a celebrar la caída de Maduro y agradecen, entre lágrimas, a Donald Trump por la liberación del país.",
  },
  {
    label: "Springfield · pets",
    text:
      "In Springfield, they're eating the dogs. The people that came in, they're eating the cats, they're eating the pets of the people that live there.",
  },
];

export default function Workbench() {
  const [text, setText] = useState("");
  const [graph, setGraph] = useState<FactGraph>(MOCK_GRAPH);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runId, setRunId] = useState(0);

  async function check(source: string) {
    const trimmed = source.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    // Reset to an empty graph for this source; the stream builds it node by node.
    setGraph(emptyGraph(trimmed));
    setRunId((n) => n + 1);

    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // keep the trailing partial line
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line) as PipelineEvent;
          if (ev.type === "error") throw new Error(ev.message);
          setGraph((g) => applyEvent(g, ev));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-slate-800 bg-slate-950/60 px-6 py-4">
        <div className="flex flex-col gap-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste a viral post, tweet, or WhatsApp forward — VERITRACE will decompose it into checkable claims and gather primary sources."
            rows={2}
            className="w-full resize-none rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-[13px] leading-relaxed text-slate-100 placeholder:text-slate-500 focus:border-sky-500/60 focus:outline-none focus:ring-1 focus:ring-sky-500/40"
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              Try:
            </span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex.label}
                disabled={loading}
                onClick={() => {
                  setText(ex.text);
                  check(ex.text);
                }}
                className="rounded-full border border-slate-700 bg-slate-800/70 px-3 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:border-sky-500/50 hover:text-sky-200 disabled:opacity-50"
              >
                {ex.label}
              </button>
            ))}
            <button
              onClick={() => check(text)}
              disabled={loading || text.trim().length === 0}
              className="ml-auto inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              {loading && (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              )}
              {loading ? "Checking…" : "Check"}
            </button>
          </div>
          {error && (
            <p className="text-[12px] text-red-400">⚠ {error}</p>
          )}
        </div>
      </div>

      <main className="relative flex-1">
        <FactGraphCanvas key={runId} graph={graph} />
        {loading && (
          <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2">
            <div className="flex items-center gap-2.5 rounded-full border border-slate-700 bg-slate-900/90 px-4 py-2 text-[12px] text-slate-200 shadow-xl backdrop-blur">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-sky-500/40 border-t-sky-400" />
              Decomposing claims, gathering primary sources…
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
