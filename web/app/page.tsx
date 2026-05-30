import Workbench from "@/components/workbench";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex items-baseline gap-3 border-b border-slate-800 px-6 py-3">
        <span className="text-lg font-semibold tracking-tight text-slate-50">
          VERITRACE
        </span>
        <span className="text-[13px] text-slate-400">
          the AI fact-checker that shows its work — you make the call
        </span>
      </header>
      <Workbench />
    </div>
  );
}
