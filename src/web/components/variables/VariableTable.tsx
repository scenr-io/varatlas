import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { AlertTriangle, FileText, Lock, Pencil, ShieldOff, Trash2 } from "lucide-preact";
import { Badge } from "@/components/ui/Badge";
import { rowId, type Row } from "@/rows";
import { visibleRange } from "@/virtual";
import { ValueCell } from "./ValueCell";

const COLUMNS = ["KEY", "VALUE", "ATTRIBUTES", "ENV SCOPE", "LOCATION", ""];
/** Every row has exactly this height, so only the rows on screen need to be rendered. */
const ROW_HEIGHT = 56;
const HEADER_HEIGHT = 37;
// Preact 11 does not append "px" to numeric style values.
const px = (n: number) => `${n}px`;

interface Props {
  rows: Row[];
  loading: boolean;
  loadError: string | null;
  onRetry: () => void;
  keyLocations: Map<string, number>;
  revealAll: boolean;
  onEdit: (r: Row) => void;
  onDelete: (r: Row) => void;
}

function Centered({ children }: { children: ComponentChildren }) {
  return (
    <div className="grid h-full place-items-center p-10">
      <div className="text-center">{children}</div>
    </div>
  );
}

function Attributes({ v }: { v: Row["v"] }) {
  return (
    <div className="flex items-center gap-1">
      {v.variable_type === "file" && (
        <Badge tone="accent" title="File variable">
          <FileText className="h-2.5 w-2.5" /> FILE
        </Badge>
      )}
      {v.protected && (
        <Badge tone="pass" title="Only on protected branches/tags">
          <Lock className="h-2.5 w-2.5" /> PROT
        </Badge>
      )}
      {v.hidden ? (
        <Badge tone="warn" title="Masked and hidden">
          HIDDEN
        </Badge>
      ) : v.masked ? (
        <Badge title="Masked in job logs">MASKED</Badge>
      ) : null}
      {v.raw && <Badge title="Variable references are NOT expanded">RAW</Badge>}
    </div>
  );
}

function VariableRow({
  r,
  locations,
  revealAll,
  onEdit,
  onDelete,
}: {
  r: Row;
  locations: number;
  revealAll: boolean;
  onEdit: (r: Row) => void;
  onDelete: (r: Row) => void;
}) {
  return (
    <tr
      style={{ height: px(ROW_HEIGHT) }}
      className="group border-b border-black/[0.05] transition-colors hover:bg-mist/70"
    >
      <td className="max-w-[260px] px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="truncate font-mono text-[12.5px] font-semibold text-ink" title={r.v.key}>
            {r.v.key}
          </span>
          {locations > 1 && (
            <Badge tone="warn" title={`Defined in ${locations} groups/projects`}>
              ×{locations}
            </Badge>
          )}
        </div>
        {r.v.description && (
          <p className="mt-0.5 max-w-[240px] truncate text-[11px] text-ink/40" title={r.v.description}>
            {r.v.description}
          </p>
        )}
      </td>
      <td className="max-w-[220px] px-4 py-2">
        <ValueCell v={r.v} revealAll={revealAll} />
      </td>
      <td className="whitespace-nowrap px-4 py-2">
        <Attributes v={r.v} />
      </td>
      <td className="whitespace-nowrap px-4 py-2 font-mono text-[12px] text-ink/55">
        {r.v.environment_scope}
      </td>
      <td className="max-w-[240px] px-4 py-2">
        <a
          href={`${r.web_url}/-/settings/ci_cd`}
          target="_blank"
          rel="noreferrer"
          className="block truncate font-mono text-[11.5px] text-ink/50 underline-offset-2 hover:text-accent hover:underline"
          title={`Open ${r.path} in GitLab`}
        >
          {r.path}
        </a>
        <span
          className={`mt-1 block font-mono text-[9px] font-bold leading-none tracking-wider ${
            r.entity === "group" ? "text-accent/70" : "text-ink/30"
          }`}
        >
          {r.entity.toUpperCase()}
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-2 text-right">
        <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button
            onClick={() => onEdit(r)}
            title="Edit"
            aria-label={`Edit ${r.v.key}`}
            className="rounded-lg p-2 text-ink/40 transition-colors hover:bg-black/5 hover:text-ink"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(r)}
            title="Delete"
            aria-label={`Delete ${r.v.key}`}
            className="rounded-lg p-2 text-ink/40 transition-colors hover:bg-accent/10 hover:text-accent"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

export function VariableTable({
  rows,
  loading,
  loadError,
  onRetry,
  keyLocations,
  revealAll,
  onEdit,
  onDelete,
}: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(800);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setViewport(el.clientHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  let body: ComponentChildren;

  if (loading) {
    body = (
      <div className="space-y-3 p-6">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="skeleton h-10 w-full" />
        ))}
        <p className="pt-2 text-center font-mono text-[10px] tracking-[0.18em] text-ink/35">
          SCANNING GROUPS &amp; PROJECTS…
        </p>
      </div>
    );
  } else if (loadError) {
    body = (
      <Centered>
        <AlertTriangle className="mx-auto h-8 w-8 text-warn" />
        <p className="mt-3 text-[14px] font-semibold text-ink">{loadError}</p>
        <button
          onClick={onRetry}
          className="mt-4 rounded-xl bg-night px-4 py-2 text-[12.5px] font-bold text-white hover:bg-ink"
        >
          Retry
        </button>
      </Centered>
    );
  } else if (rows.length === 0) {
    body = (
      <Centered>
        <ShieldOff className="mx-auto h-8 w-8 text-ink/20" />
        <p className="mt-3 text-[14px] font-semibold text-ink/60">No variables match</p>
        <p className="mt-1 text-[12px] text-ink/40">Adjust filters or add a new variable.</p>
      </Centered>
    );
  } else {
    const { start, end } = visibleRange(rows.length, ROW_HEIGHT, scrollTop - HEADER_HEIGHT, viewport);
    body = (
      <table className="w-full border-collapse text-left">
        <thead className="sticky top-0 z-10 bg-mist">
          <tr className="border-b border-black/[0.07]" style={{ height: px(HEADER_HEIGHT) }}>
            {COLUMNS.map((h, i) => (
              <th
                key={i}
                className="whitespace-nowrap px-4 font-mono text-[9.5px] font-bold tracking-[0.16em] text-ink/40"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {start > 0 && <tr aria-hidden="true" style={{ height: px(start * ROW_HEIGHT) }} />}
          {rows.slice(start, end).map((r) => (
            <VariableRow
              key={rowId(r)}
              r={r}
              locations={keyLocations.get(r.v.key) ?? 0}
              revealAll={revealAll}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
          {end < rows.length && (
            <tr aria-hidden="true" style={{ height: px((rows.length - end) * ROW_HEIGHT) }} />
          )}
        </tbody>
      </table>
    );
  }

  return (
    <div
      ref={scroller}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      className="min-h-0 flex-1 overflow-auto rounded-t-2xl border border-b-0 border-black/[0.07] bg-white"
    >
      {body}
    </div>
  );
}
