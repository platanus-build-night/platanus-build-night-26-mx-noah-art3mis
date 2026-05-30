// Shared visual vocabulary for verdicts and stances — used by both node cards and edges
// so the graph reads consistently (green supports, red refutes, amber conflicting/contextualizes).
import type { Verdict, Stance, Reliability } from "./graph-types";

export const VERDICT_META: Record<
  Verdict,
  { label: string; fg: string; bg: string; border: string; dot: string }
> = {
  supported: {
    label: "Supported",
    fg: "text-emerald-300",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/40",
    dot: "bg-emerald-400",
  },
  refuted: {
    label: "Refuted",
    fg: "text-red-300",
    bg: "bg-red-500/10",
    border: "border-red-500/40",
    dot: "bg-red-400",
  },
  conflicting: {
    label: "Conflicting",
    fg: "text-amber-300",
    bg: "bg-amber-500/10",
    border: "border-amber-500/40",
    dot: "bg-amber-400",
  },
  nei: {
    label: "Not Enough Evidence",
    fg: "text-slate-300",
    bg: "bg-slate-500/10",
    border: "border-slate-500/40",
    dot: "bg-slate-400",
  },
};

export const STANCE_META: Record<
  Stance,
  { label: string; stroke: string; fg: string }
> = {
  supports: { label: "supports", stroke: "#34d399", fg: "text-emerald-300" },
  refutes: { label: "refutes", stroke: "#f87171", fg: "text-red-300" },
  contextualizes: { label: "context", stroke: "#fbbf24", fg: "text-amber-300" },
};

export const RELIABILITY_META: Record<
  Reliability,
  { label: string; fg: string }
> = {
  high: { label: "high reliability", fg: "text-emerald-300" },
  medium: { label: "medium reliability", fg: "text-amber-300" },
  low: { label: "low reliability", fg: "text-red-300" },
};
