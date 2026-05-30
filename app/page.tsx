import Link from "next/link";
import Workbench from "@/components/workbench";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* hairline accent at the very top edge */}
      <div
        className="h-[2px] w-full shrink-0"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--accent), transparent 70%)",
        }}
      />
      <header className="vt-reveal relative flex items-end justify-between gap-4 border-b border-[var(--line)] bg-[var(--bg-2)]/70 px-6 py-3 backdrop-blur">
        <div className="flex items-end gap-3.5">
          <h1 className="font-display text-[26px] font-semibold leading-none tracking-[-0.02em] text-[var(--ink-1)]">
            Veri<span style={{ color: "var(--accent)" }}>trace</span>
          </h1>
          <span className="font-display mb-[3px] hidden text-[13.5px] italic leading-none text-[var(--ink-2)] md:inline">
            the fact-checker that shows its work
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/methodology"
            className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--ink-2)] transition-colors hover:text-[var(--accent)]"
          >
            Methodology &amp; refs
          </Link>
          <div
            className="hidden items-center gap-2 rounded-full border px-3 py-1.5 sm:flex"
            style={{ borderColor: "rgba(58,214,230,0.3)", background: "rgba(58,214,230,0.06)" }}
          >
            <span
              className="vt-pulse h-1.5 w-1.5 rounded-full"
              style={{ background: "var(--accent)", color: "var(--accent)" }}
            />
            <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--ink-2)]">
              de novo · no fact-checkers in-loop
            </span>
          </div>
        </div>
      </header>
      <Workbench />
    </div>
  );
}
