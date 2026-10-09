import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { CornerLeftUp, Pencil, Trash2, TriangleAlert } from "lucide-preact";
import type { EffectiveRow } from "@/insights";
import { rowId, type Row } from "@/rows";
import { visibleRange } from "@/virtual";
import { Settings } from "./Settings";
import { ValueCell } from "./ValueCell";

/** Every row has exactly this height, so only the rows on screen need to be rendered. */
const ROW_HEIGHT = 56;
const HEADER_HEIGHT = 36;
// Preact 11 does not append "px" to numeric style values.
const px = (n: number) => `${n}px`;

const COLUMNS = ["Key", "Value", "Settings", "Environment", "Defined in", ""];

interface Props {
  rows: EffectiveRow[];
  loading: boolean;
  loadError: string | null;
  onRetry: () => void;
  keyLocations: Map<string, number>;
  revealAll: boolean;
  onOpenKey: (key: string) => void;
  onEdit: (r: Row) => void;
  onDelete: (r: Row) => void;
  empty: ComponentChildren;
  readOnly?: boolean;
}

export function Centered({ children }: { children: ComponentChildren }) {
  return (
    <div className="grid h-full min-h-60 place-items-center p-10">
      <div className="max-w-sm text-center">{children}</div>
    </div>
  );
}

function DefinedIn({ r }: { r: EffectiveRow }) {
  if (r.inheritedFrom) {
    return (
      <div className="min-w-0">
        <p className="flex items-center gap-1 text-xs text-fg-3">
          <CornerLeftUp className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
          {r.overriddenBy
            ? "Inherited, replaced here"
            : r.overriddenIn
              ? `Inherited, replaced in ${r.overriddenIn.join(", ")}`
              : "Inherited from"}
        </p>
        <a
          href={`${r.web_url}/-/settings/ci_cd`}
          target="_blank"
          rel="noreferrer"
          className="block truncate font-mono text-xs text-fg-2 hover:text-accent hover:underline"
        >
          {r.inheritedFrom}
        </a>
      </div>
    );
  }
  return (
    <div className="min-w-0">
      <p className="text-xs text-fg-3">{r.entity === "group" ? "Group" : "Project"}</p>
      <a
        href={`${r.web_url}/-/settings/ci_cd`}
        target="_blank"
        rel="noreferrer"
        title={`Open ${r.path} in GitLab`}
        className="block truncate font-mono text-xs text-fg-2 hover:text-accent hover:underline"
      >
        {r.path}
      </a>
    </div>
  );
}

function VariableRow({
  r,
  locations,
  revealAll,
  onOpenKey,
  onEdit,
  onDelete,
  readOnly,
}: {
  r: EffectiveRow;
  locations: number;
  revealAll: boolean;
  onOpenKey: (key: string) => void;
  onEdit: (r: Row) => void;
  onDelete: (r: Row) => void;
  readOnly?: boolean;
}) {
  const replaced = !!r.overriddenBy;
  return (
    <tr
      style={{ height: px(ROW_HEIGHT) }}
      className={`group border-b border-line transition-colors hover:bg-raised/50 ${replaced ? "opacity-55" : ""}`}
    >
      <td className="max-w-[280px] px-4">
        <button
          onClick={() => onOpenKey(r.v.key)}
          className="block max-w-full truncate text-left font-mono text-[13px] font-medium text-fg hover:text-accent"
          title={`See every ${r.v.key} in the org`}
        >
          {r.v.key}
        </button>
        <p className="mt-0.5 flex min-w-0 gap-2 text-xs text-fg-3">
          {locations > 1 && <span className="flex-shrink-0 text-fg-2">In {locations} places</span>}
          {r.v.description && <span className="truncate">{r.v.description}</span>}
        </p>
      </td>
      <td className="max-w-[220px] px-4">
        <ValueCell v={r.v} revealAll={revealAll} />
      </td>
      <td className="px-4">
        <Settings v={r.v} />
      </td>
      <td className="whitespace-nowrap px-4 font-mono text-xs text-fg-2">
        {r.v.environment_scope === "*" ? "* (all)" : r.v.environment_scope}
      </td>
      <td className="max-w-[260px] px-4">
        <DefinedIn r={r} />
      </td>
      <td className="whitespace-nowrap px-3 text-right">
        {!readOnly && (
          <div className="flex justify-end gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            <button
              onClick={() => onEdit(r)}
              title={r.inheritedFrom ? `Edit in ${r.inheritedFrom}` : "Edit"}
              aria-label={`Edit ${r.v.key} in ${r.path}`}
              className="rounded-md p-2 text-fg-3 transition-colors hover:bg-raised hover:text-fg"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onDelete(r)}
              title={r.inheritedFrom ? `Delete from ${r.inheritedFrom}` : "Delete"}
              aria-label={`Delete ${r.v.key} from ${r.path}`}
              className="rounded-md p-2 text-fg-3 transition-colors hover:bg-critical/15 hover:text-critical"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

export function VariableTable(p: Props) {
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
  if (p.loading) {
    body = (
      <div className="space-y-3 p-5" aria-label="Loading variables">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="skeleton h-10 w-full" />
        ))}
      </div>
    );
  } else if (p.loadError) {
    body = (
      <Centered>
        <TriangleAlert className="mx-auto h-6 w-6 text-warning" aria-hidden="true" />
        <p className="mt-3 font-medium text-fg">Couldn't load variables</p>
        <p className="mt-1 text-sm text-fg-2">{p.loadError}</p>
        <button
          onClick={p.onRetry}
          className="mt-4 rounded-lg border border-line-strong px-4 py-2 text-sm font-medium text-fg hover:bg-raised"
        >
          Try again
        </button>
      </Centered>
    );
  } else if (p.rows.length === 0) {
    body = <Centered>{p.empty}</Centered>;
  } else {
    const { start, end } = visibleRange(p.rows.length, ROW_HEIGHT, scrollTop - HEADER_HEIGHT, viewport);
    body = (
      <table className="w-full border-collapse text-left">
        <thead className="sticky top-0 z-10 bg-surface">
          <tr className="border-b border-line" style={{ height: px(HEADER_HEIGHT) }}>
            {COLUMNS.map((h, i) => (
              <th key={i} scope="col" className="whitespace-nowrap px-4 text-xs font-medium text-fg-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {start > 0 && <tr aria-hidden="true" style={{ height: px(start * ROW_HEIGHT) }} />}
          {p.rows.slice(start, end).map((r) => (
            <VariableRow
              key={rowId(r)}
              r={r}
              locations={p.keyLocations.get(r.v.key) ?? 0}
              revealAll={p.revealAll}
              onOpenKey={p.onOpenKey}
              onEdit={p.onEdit}
              onDelete={p.onDelete}
              readOnly={p.readOnly}
            />
          ))}
          {end < p.rows.length && (
            <tr aria-hidden="true" style={{ height: px((p.rows.length - end) * ROW_HEIGHT) }} />
          )}
        </tbody>
      </table>
    );
  }

  return (
    <div
      ref={scroller}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      className="min-h-0 flex-1 overflow-auto rounded-t-xl border border-b-0 border-line bg-surface"
    >
      {body}
    </div>
  );
}
