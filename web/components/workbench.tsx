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
      <div className="vt-reveal border-b border-[var(--line)] bg-[var(--bg-2)]/60 px-6 py-3.5">
        <div className="flex flex-col gap-3">
          <label className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-[var(--ink-3)]">
            ▣ Paste source text · the artifact under examination
          </label>
          <div
            className="rounded-lg border bg-[var(--bg)] transition-colors focus-within:border-[var(--accent)]"
            style={{ borderColor: "var(--line-2)" }}
          >
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="A tweet, WhatsApp forward, or Facebook caption… VERITRACE decomposes it into checkable claims and gathers primary sources, live."
              rows={2}
              className="w-full resize-none bg-transparent px-3.5 py-2.5 text-[13.5px] leading-relaxed text-[var(--ink-1)] placeholder:italic placeholder:text-[var(--ink-3)] focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--ink-3)]">
              Specimens
            </span>
            {EXAMPLES.map((ex, i) => (
              <button
                key={ex.label}
                disabled={loading}
                onClick={() => {
                  setText(ex.text);
                  check(ex.text);
                }}
                className="group inline-flex items-center gap-1.5 rounded-md border border-[var(--line-2)] bg-[var(--panel)] px-2.5 py-1 font-mono text-[10.5px] text-[var(--ink-2)] transition-colors hover:border-[var(--accent)] hover:text-[var(--ink-1)] disabled:opacity-40"
              >
                <span className="text-[var(--ink-4)] group-hover:text-[var(--accent)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {ex.label}
              </button>
            ))}
            <button
              onClick={() => check(text)}
              disabled={loading || text.trim().length === 0}
              className="ml-auto inline-flex items-center gap-2 rounded-md px-4 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-[#04181b] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                background:
                  loading || text.trim().length === 0
                    ? "var(--line-2)"
                    : "var(--accent)",
                color: loading || text.trim().length === 0 ? "var(--ink-3)" : "#04181b",
                boxShadow:
                  loading || text.trim().length === 0
                    ? "none"
                    : "0 0 18px rgba(58,214,230,0.35)",
              }}
            >
              {loading ? (
                <>
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-current/40 border-t-current" />
                  Analyzing
                </>
              ) : (
                <>▸ Run check</>
              )}
            </button>
          </div>
          {error && (
            <p
              className="font-mono text-[11px]"
              style={{ color: "var(--refutes)" }}
            >
              ⚠ {error}
            </p>
          )}
        </div>
      </div>

      <main className="relative flex-1">
        <FactGraphCanvas key={runId} graph={graph} />
        {loading && (
          <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2">
            <div
              className="flex items-center gap-2.5 rounded-full border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] shadow-xl backdrop-blur"
              style={{
                borderColor: "rgba(58,214,230,0.3)",
                background: "rgba(11,14,21,0.9)",
                color: "var(--ink-2)",
              }}
            >
              <span
                className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-t-transparent"
                style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
              />
              Decomposing claims · gathering primary sources
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
