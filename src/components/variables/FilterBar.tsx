"use client";

import { Eye, EyeOff, Search, X } from "lucide-react";
import type { AttrFilter, LevelFilter } from "@/lib/rows";

const LEVELS: [LevelFilter, string][] = [
  ["all", "All"],
  ["group", "Groups"],
  ["project", "Projects"],
];

const ATTRS: [AttrFilter, string][] = [
  ["protected", "Protected"],
  ["masked", "Masked"],
  ["file", "File"],
];

const chip = "rounded-xl border px-3.5 py-2 text-[12px] font-semibold transition-colors";
const chipOff = "border-black/[0.08] bg-white text-ink/50 hover:border-black/20";

interface Props {
  query: string;
  onQuery: (q: string) => void;
  level: LevelFilter;
  onLevel: (l: LevelFilter) => void;
  attrs: ReadonlySet<AttrFilter>;
  onToggleAttr: (a: AttrFilter) => void;
  scope: string;
  scopes: string[];
  onScope: (s: string) => void;
  revealAll: boolean;
  onToggleReveal: () => void;
}

export function FilterBar(p: Props) {
  return (
    <div className="mb-4 flex flex-shrink-0 flex-wrap items-center gap-2">
      <div className="relative min-w-[220px] flex-1">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/30" />
        <input
          value={p.query}
          onChange={(e) => p.onQuery(e.target.value)}
          placeholder="Search keys, values, scopes, paths…"
          aria-label="Search variables"
          className="glass-input w-full !py-2.5 !pl-10 text-[13px]"
        />
        {p.query && (
          <button
            onClick={() => p.onQuery("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink/30 hover:text-ink"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex overflow-hidden rounded-xl border border-black/[0.08] bg-white">
        {LEVELS.map(([value, label]) => (
          <button
            key={value}
            onClick={() => p.onLevel(value)}
            aria-pressed={p.level === value}
            className={`px-3.5 py-2 text-[12px] font-semibold transition-colors ${
              p.level === value ? "bg-night text-white" : "text-ink/50 hover:bg-black/[0.03]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {ATTRS.map(([value, label]) => (
        <button
          key={value}
          onClick={() => p.onToggleAttr(value)}
          aria-pressed={p.attrs.has(value)}
          className={`${chip} ${
            p.attrs.has(value) ? "border-accent/50 bg-accent/[0.07] text-accent" : chipOff
          }`}
        >
          {label}
        </button>
      ))}

      <button
        onClick={p.onToggleReveal}
        aria-pressed={p.revealAll}
        title={
          p.revealAll
            ? "Mask all values again"
            : "Show every value in plaintext (hidden variables stay hidden — GitLab never returns them)"
        }
        className={`flex items-center gap-1.5 ${chip} ${
          p.revealAll ? "border-warn/50 bg-warn/[0.08] text-warn" : chipOff
        }`}
      >
        {p.revealAll ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        {p.revealAll ? "Hide values" : "Reveal all"}
      </button>

      {p.scopes.length > 1 && (
        <select
          value={p.scope}
          onChange={(e) => p.onScope(e.target.value)}
          aria-label="Environment scope"
          className="rounded-xl border border-black/[0.08] bg-white px-3 py-2 font-mono text-[12px] text-ink/60 focus:border-accent/50 focus:outline-none"
        >
          <option value="all">env: all scopes</option>
          {p.scopes.map((s) => (
            <option key={s} value={s}>
              env: {s}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
