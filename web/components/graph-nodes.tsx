import { Handle, Position, type NodeProps, type NodeTypes } from "@xyflow/react";
import type {
  SourceNode,
  ClaimNode,
  QuestionNode,
  EvidenceNode,
} from "@/lib/graph-to-flow";
import { VERDICT_META, STANCE_META, RELIABILITY_META } from "@/lib/visuals";
import type { Verdict } from "@/lib/graph-types";

const IN = <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-slate-600" />;
const OUT = <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-0 !bg-slate-600" />;

function VerdictBadge({ verdict }: { verdict: Verdict | null }) {
  if (!verdict) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-600/50 bg-slate-700/30 px-2 py-0.5 text-[10px] font-medium text-slate-400">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400" /> analyzing…
      </span>
    );
  }
  const m = VERDICT_META[verdict];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${m.border} ${m.bg} ${m.fg}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} /> {m.label}
    </span>
  );
}

function SourceNodeCard({ data }: NodeProps<SourceNode>) {
  const { item } = data;
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/95 p-4 shadow-xl backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Source text</span>
        <VerdictBadge verdict={item.verdict} />
      </div>
      <p className="text-[13px] leading-relaxed text-slate-200">{item.text}</p>
      {OUT}
    </div>
  );
}

function ClaimNodeCard({ data }: NodeProps<ClaimNode>) {
  const { item } = data;
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/95 p-3.5 shadow-xl backdrop-blur">
      {IN}
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Claim</span>
        <VerdictBadge verdict={item.verdict} />
      </div>
      <p className="text-[13px] font-medium leading-snug text-slate-100">{item.text}</p>
      {item.rationale && <p className="mt-2 text-[11px] leading-snug text-slate-400">{item.rationale}</p>}
      {!item.checkable && (
        <p className="mt-2 text-[10px] font-medium text-slate-500">⚠ not verifiable from text alone</p>
      )}
      {OUT}
    </div>
  );
}

function QuestionNodeCard({ data }: NodeProps<QuestionNode>) {
  const { item } = data;
  const searching = item.status === "searching";
  return (
    <div className="rounded-lg border border-slate-700/80 bg-slate-800/80 px-3 py-2.5 shadow-lg">
      {IN}
      <div className="mb-1 flex items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-sky-400/80">Question</span>
        {searching && (
          <span className="inline-flex items-center gap-1 text-[10px] text-sky-300">
            <span className="h-1.5 w-1.5 animate-ping rounded-full bg-sky-400" /> searching…
          </span>
        )}
      </div>
      <p className="text-[12px] leading-snug text-slate-200">{item.text}</p>
      {OUT}
    </div>
  );
}

function EvidenceNodeCard({ data }: NodeProps<EvidenceNode>) {
  const { item } = data;
  const stance = STANCE_META[item.stance];
  const rel = RELIABILITY_META[item.reliability];
  return (
    <div className="rounded-xl border bg-slate-900/95 p-3 shadow-xl backdrop-blur" style={{ borderColor: stance.stroke + "66" }}>
      {IN}
      <div className="mb-1.5 flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.faviconUrl} alt="" className="h-4 w-4 rounded-sm" />
        <span className="truncate text-[11px] text-slate-400">{item.domain}</span>
        {item.publishedDate && <span className="ml-auto text-[10px] text-slate-500">{item.publishedDate}</span>}
      </div>
      <a href={item.url} target="_blank" rel="noopener noreferrer" className="block text-[12px] font-semibold leading-snug text-slate-100 hover:text-white hover:underline">
        {item.title}
      </a>
      <p className="mt-1.5 line-clamp-3 border-l-2 pl-2 text-[11px] italic leading-snug text-slate-300" style={{ borderColor: stance.stroke }}>
        “{item.passage}”
      </p>
      <div className="mt-2 flex items-center gap-2 text-[10px] font-medium">
        <span className={stance.fg}>▸ {stance.label}</span>
        <span className="text-slate-600">·</span>
        <span className={rel.fg}>{rel.label}</span>
        <span className="text-slate-600">·</span>
        <span className="text-slate-400">{item.sourceType}</span>
      </div>
    </div>
  );
}

export const nodeTypes: NodeTypes = {
  source: SourceNodeCard,
  claim: ClaimNodeCard,
  question: QuestionNodeCard,
  evidence: EvidenceNodeCard,
};
