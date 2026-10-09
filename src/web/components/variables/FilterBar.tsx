/* Search and filters above the variables table, plus the by-location / by-key switch. */

import { useEffect, useRef } from "preact/hooks";
import { Eye, EyeOff, Search, X } from "lucide-preact";
import { scopeLabel } from "@/format";
import type { AttrFilter, LevelFilter } from "@/rows";

export type Mode = "location" | "key";

const MODES: [Mode, string][] = [
  ["location", "By location"],
  ["key", "By key"],
];

const LEVELS: [LevelFilter, string][] = [
  ["all", "Everywhere"],
  ["group", "On groups"],
  ["project", "On projects"],
];

const ATTRS: [AttrFilter, string][] = [
  ["secret", "Secret-looking"],
  ["masked", "Masked"],
  ["protected", "Protected"],
  ["file", "File"],
];

const segment = (on: boolean) =>
  `px-3 py-1.5 text-[13px] transition-colors ${on ? "bg-raised font-medium text-fg" : "text-fg-2 hover:text-fg"}`;
const toggle = (on: boolean) =>
  `rounded-md border px-2.5 py-1.5 text-[13px] transition-colors ${
    on
      ? "border-accent/50 bg-accent/10 text-accent"
      : "border-line text-fg-2 hover:border-line-strong hover:text-fg"
  }`;

interface Props {
  mode: Mode;
  onMode: (m: Mode) => void;
  query: string;
  onQuery: (q: string) => void;
  /** hidden when a project is selected: its view mixes its own and inherited variables */
  showLevel: boolean;
  level: LevelFilter;
  onLevel: (l: LevelFilter) => void;
  attrs: ReadonlySet<AttrFilter>;
  onToggleAttr: (a: AttrFilter) => void;
  scope: string;
  scopes: string[];
  onScope: (s: string) => void;
  revealAll: boolean;
  onToggleReveal: () => void;
  /** an active finding filter, e.g. "Secrets that aren't masked" */
  finding: string | null;
  onClearFinding: () => void;
}

export function FilterBar(p: Props) {
  const search = useRef<HTMLInputElement>(null);

  // "/" jumps to search, as in GitLab and GitHub.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing =
        e.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName);
      if (e.key === "/" && !typing) {
        e.preventDefault();
        search.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-3" aria-hidden="true" />
          <input
            ref={search}
            value={p.query}
            onInput={(e) => p.onQuery(e.currentTarget.value)}
            placeholder="Search keys, values, environments and paths"
            aria-label="Search variables"
            className="field w-full !pl-9 !pr-14 text-sm"
          />
          {p.query ? (
            <button
              onClick={() => p.onQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-fg-3 hover:text-fg"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-line px-1.5 font-mono text-[11px] text-fg-3">
              /
            </kbd>
          )}
        </div>

        <div
          className="flex overflow-hidden rounded-md border border-line"
          role="group"
          aria-label="Group results"
        >
          {MODES.map(([m, label]) => (
            <button
              key={m}
              onClick={() => p.onMode(m)}
              aria-pressed={p.mode === m}
              className={segment(p.mode === m)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {p.finding && (
          <span className="flex items-center gap-1.5 rounded-md border border-accent/50 bg-accent/10 py-1 pl-2.5 pr-1 text-[13px] text-accent">
            {p.finding}
            <button
              onClick={p.onClearFinding}
              aria-label="Clear finding filter"
              className="rounded p-0.5 hover:bg-accent/20"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        )}

        {p.showLevel && (
          <div
            className="flex overflow-hidden rounded-md border border-line"
            role="group"
            aria-label="Where defined"
          >
            {LEVELS.map(([l, label]) => (
              <button
                key={l}
                onClick={() => p.onLevel(l)}
                aria-pressed={p.level === l}
                className={segment(p.level === l)}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {ATTRS.map(([a, label]) => (
          <button
            key={a}
            onClick={() => p.onToggleAttr(a)}
            aria-pressed={p.attrs.has(a)}
            className={toggle(p.attrs.has(a))}
          >
            {label}
          </button>
        ))}

        {p.scopes.length > 1 && (
          <select
            value={p.scope}
            onChange={(e) => p.onScope(e.currentTarget.value)}
            aria-label="Environment"
            className="field !py-1.5 text-[13px]"
          >
            <option value="all">All environments</option>
            {p.scopes.map((s) => (
              <option key={s} value={s}>
                {scopeLabel(s)}
              </option>
            ))}
          </select>
        )}

        <button
          onClick={p.onToggleReveal}
          aria-pressed={p.revealAll}
          title="Hidden variables stay hidden because GitLab never returns their values."
          className={`ml-auto flex items-center gap-1.5 ${toggle(p.revealAll)}`}
        >
          {p.revealAll ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {p.revealAll ? "Hide values" : "Show values"}
        </button>
      </div>
    </div>
  );
}
