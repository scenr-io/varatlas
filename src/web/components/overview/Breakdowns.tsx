import type { ComponentChildren } from "preact";
import { Chip } from "@/components/ui/Badge";
import type { KeySummary, Posture } from "@/insights";

const pct = (n: number, max: number) => `${max === 0 ? 0 : (n / max) * 100}%`;
const MAX_BARS = 6;

/** A thin bar on a baseline: 4px rounded data end, square at the start. */
function Bar({ value, max }: { value: number; max: number }) {
  return (
    <span className="flex h-2 flex-1 items-center" aria-hidden="true">
      <span className="h-2 rounded-r bg-series-1" style={{ width: pct(value, max) }} />
    </span>
  );
}

export function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ComponentChildren;
}) {
  return (
    <section className="border-t border-line pt-4">
      <h2 className="text-sm font-semibold text-fg">{title}</h2>
      {note && <p className="mt-0.5 text-xs text-fg-3">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** How many variables carry each protection, as meters against the total. */
export function ProtectionMeters({ posture }: { posture: Posture }) {
  const rows: [string, number][] = [
    ["Masked in job logs", posture.masked],
    ["Protected branches and tags only", posture.protected],
    ["Masked and hidden", posture.hidden],
  ];
  return (
    <ul className="space-y-4">
      {rows.map(([label, n]) => (
        <li key={label}>
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="text-fg-2">{label}</span>
            <span className="tabular-nums text-fg">
              {n} <span className="text-fg-3">of {posture.total}</span>
            </span>
          </div>
          <div className="mt-1.5 h-2 rounded-r bg-track" role="meter" aria-valuenow={n} aria-valuemax={posture.total} aria-label={label}>
            <div className="h-2 rounded-r bg-series-1" style={{ width: pct(n, posture.total) }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Variables per environment scope. The tail folds into "Other". */
export function ScopeBars({
  scopes,
  onPick,
}: {
  scopes: { scope: string; count: number }[];
  onPick: (scope: string) => void;
}) {
  if (scopes.length === 1) {
    const [only] = scopes;
    return (
      <p className="text-[13px] leading-relaxed text-fg-2">
        {only.count === 1 ? "The only variable" : `All ${only.count} variables`}{" "}
        {only.scope === "*" ? (
          <>
            apply to every environment (<span className="font-mono">*</span>).
          </>
        ) : (
          <>
            {only.count === 1 ? "is" : "are"} scoped to <span className="font-mono">{only.scope}</span>.
          </>
        )}
      </p>
    );
  }
  const head = scopes.slice(0, MAX_BARS);
  const tail = scopes.slice(MAX_BARS);
  const max = Math.max(1, ...scopes.map((s) => s.count));
  return (
    <ul className="space-y-1">
      {head.map((s) => (
        <li key={s.scope}>
          <button
            onClick={() => onPick(s.scope)}
            className="grid w-full grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_2rem] items-center gap-3 rounded-md px-1 py-1 text-left transition-colors hover:bg-raised/60"
            aria-label={`${s.count} variables in ${s.scope === "*" ? "all environments" : s.scope}. Show them.`}
          >
            <span className="truncate font-mono text-xs text-fg-2">{s.scope === "*" ? "* (all)" : s.scope}</span>
            <Bar value={s.count} max={max} />
            <span className="text-right text-xs tabular-nums text-fg-2">{s.count}</span>
          </button>
        </li>
      ))}
      {tail.length > 0 && (
        <li className="px-1 py-1 text-xs text-fg-3">
          Other: {tail.reduce((n, s) => n + s.count, 0)} variables in {tail.length} more environments
        </li>
      )}
    </ul>
  );
}

const VALUES = {
  same: { tone: "neutral", label: "Same value" },
  different: { tone: "warning", label: "Values differ" },
  unreadable: { tone: "neutral", label: "Hidden values" },
} as const;

/** Keys defined in the most places, with whether their copies agree. */
export function RepeatedKeys({ keys, onOpen }: { keys: KeySummary[]; onOpen: (key: string) => void }) {
  const repeated = keys.filter((k) => k.locations > 1).slice(0, MAX_BARS);
  if (repeated.length === 0) {
    return <p className="text-[13px] text-fg-2">Every key is defined in one place.</p>;
  }
  const max = Math.max(...repeated.map((k) => k.locations));
  return (
    <ul className="space-y-1">
      {repeated.map((k) => (
        <li key={k.key}>
          <button
            onClick={() => onOpen(k.key)}
            className="grid w-full grid-cols-[minmax(0,1fr)_4rem_auto] items-center gap-3 rounded-md px-1 py-1 text-left transition-colors hover:bg-raised/60"
            aria-label={`${k.key}: defined in ${k.locations} places. ${VALUES[k.values].label}. Open details.`}
          >
            <span className="truncate font-mono text-xs text-fg">{k.key}</span>
            <span className="flex items-center gap-2">
              <Bar value={k.locations} max={max} />
              <span className="text-xs tabular-nums text-fg-2">{k.locations}</span>
            </span>
            <Chip tone={VALUES[k.values].tone}>{VALUES[k.values].label}</Chip>
          </button>
        </li>
      ))}
    </ul>
  );
}
