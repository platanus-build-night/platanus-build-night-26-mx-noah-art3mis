"use client";

import { MODELS, DEFAULT_MODEL, type ModelId } from "@/lib/run-config";

// The user-facing run settings. Mirrors RunConfig but keeps the two API keys as plain
// strings (always-controlled inputs); the empty string means "use the server default".
export interface Settings {
  model: ModelId;
  temperature: number;
  thinking: boolean;
  anthropicKey: string;
  exaKey: string;
}

export const DEFAULT_SETTINGS: Settings = {
  model: DEFAULT_MODEL,
  temperature: 0,
  thinking: false,
  anthropicKey: "",
  exaKey: "",
};

const labelCls =
  "font-mono text-[9.5px] uppercase tracking-[0.22em] text-[var(--ink-3)]";
const fieldCls =
  "w-full rounded-md border border-[var(--line-2)] bg-[var(--bg)] px-2.5 py-1.5 font-mono text-[11.5px] text-[var(--ink-1)] focus:border-[var(--accent)] focus:outline-none";

export function SettingsPanel({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (next: Settings) => void;
}) {
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    onChange({ ...settings, [key]: value });

  return (
    <div className="grid gap-4 rounded-lg border border-[var(--line-2)] bg-[var(--bg)]/60 p-4 sm:grid-cols-2">
      {/* Model */}
      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>Model</label>
        <select
          value={settings.model}
          onChange={(e) => set("model", e.target.value as ModelId)}
          className={fieldCls}
        >
          {(Object.entries(MODELS) as [ModelId, string][]).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {/* Temperature */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <label className={labelCls}>Temperature</label>
          <span className="font-mono text-[10.5px] text-[var(--ink-2)]">
            {settings.thinking ? "1.0 · thinking" : settings.temperature.toFixed(2)}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={settings.temperature}
          disabled={settings.thinking}
          onChange={(e) => set("temperature", Number(e.target.value))}
          className="w-full accent-[var(--accent)] disabled:opacity-40"
        />
        <span className="font-mono text-[9px] text-[var(--ink-4)]">
          {settings.thinking
            ? "fixed at 1 while extended thinking is on"
            : "0 = deterministic · 1 = most varied"}
        </span>
      </div>

      {/* Extended thinking */}
      <div className="flex flex-col gap-1.5">
        <label className={labelCls}>Extended thinking</label>
        <button
          type="button"
          role="switch"
          aria-checked={settings.thinking}
          onClick={() => set("thinking", !settings.thinking)}
          className="inline-flex w-fit items-center gap-2 rounded-md border border-[var(--line-2)] bg-[var(--panel)] px-2.5 py-1.5 font-mono text-[11px] text-[var(--ink-2)] transition-colors hover:border-[var(--accent)]"
        >
          <span
            className="h-2.5 w-2.5 rounded-full transition-colors"
            style={{ background: settings.thinking ? "var(--accent)" : "var(--line-2)" }}
          />
          {settings.thinking ? "On" : "Off"}
        </button>
      </div>

      {/* API keys */}
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <label className={labelCls}>Your API keys · optional, stored in this browser</label>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={settings.anthropicKey}
            onChange={(e) => set("anthropicKey", e.target.value)}
            placeholder="ANTHROPIC_API_KEY · blank uses server default"
            className={fieldCls}
          />
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={settings.exaKey}
            onChange={(e) => set("exaKey", e.target.value)}
            placeholder="EXA_API_KEY · blank uses server default"
            className={fieldCls}
          />
        </div>
        <span className="font-mono text-[9px] text-[var(--ink-4)]">
          Sent only with your check requests and used in-memory; never stored on the server.
        </span>
      </div>
    </div>
  );
}
