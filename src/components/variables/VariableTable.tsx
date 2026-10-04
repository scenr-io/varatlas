"use client";

import { AlertTriangle, FileText, Lock, Pencil, ShieldOff, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { rowId, type Row } from "@/lib/rows";
import { ValueCell } from "./ValueCell";

const COLUMNS = ["KEY", "VALUE", "ATTRIBUTES", "ENV SCOPE", "LOCATION", ""];

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

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid h-full place-items-center p-10">
      <div className="text-center">{children}</div>
    </div>
  );
}

function Attributes({ v }: { v: Row["v"] }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
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
  let body: React.ReactNode;

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
    body = (
      <table className="w-full border-collapse text-left">
        <thead className="sticky top-0 z-10 bg-mist">
          <tr className="border-b border-black/[0.07]">
            {COLUMNS.map((h, i) => (
              <th
                key={i}
                className="whitespace-nowrap px-4 py-3 font-mono text-[9.5px] font-bold tracking-[0.16em] text-ink/40"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const locations = keyLocations.get(r.v.key) ?? 0;
            return (
              <tr
                key={rowId(r)}
                className="group border-b border-black/[0.05] transition-colors last:border-b-0 hover:bg-mist/70"
              >
                <td className="max-w-[260px] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="truncate font-mono text-[12.5px] font-semibold text-ink"
                      title={r.v.key}
                    >
                      {r.v.key}
                    </span>
                    {locations > 1 && (
                      <Badge tone="warn" title={`Defined in ${locations} groups/projects`}>
                        ×{locations}
                      </Badge>
                    )}
                  </div>
                  {r.v.description && (
                    <p
                      className="mt-0.5 max-w-[240px] truncate text-[11px] text-ink/40"
                      title={r.v.description}
                    >
                      {r.v.description}
                    </p>
                  )}
                </td>
                <td className="max-w-[220px] px-4 py-3">
                  <ValueCell v={r.v} revealAll={revealAll} />
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <Attributes v={r.v} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-mono text-[12px] text-ink/55">
                  {r.v.environment_scope}
                </td>
                <td className="max-w-[240px] px-4 py-3">
                  <a
                    href={`${r.web_url}/-/settings/ci_cd`}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate font-mono text-[11.5px] text-ink/50 underline-offset-2 hover:text-accent hover:underline"
                    title={`${r.path} — open in GitLab`}
                  >
                    {r.path}
                  </a>
                  <span
                    className={`font-mono text-[9px] font-bold tracking-wider ${
                      r.entity === "group" ? "text-accent/70" : "text-ink/30"
                    }`}
                  >
                    {r.entity.toUpperCase()}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
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
          })}
        </tbody>
      </table>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-t-2xl border border-b-0 border-black/[0.07] bg-white">
      {body}
    </div>
  );
}
