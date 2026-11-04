/* Review and apply one fix (mask or protect) to many variables behind a finding. */

import { Loader2, TriangleAlert } from "lucide-preact";
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { FIX_WORDS, type FixItem, type FixKind } from "@/fixes";
import { plural, scopeLabel } from "@/format";
import { rowId, type Row } from "@/rows";

const INTRO: Record<FixKind, string> = {
  mask: "Masked values are replaced by [MASKED] in job logs. Nothing else about them changes.",
  protect: "Protected variables only reach pipelines on protected branches and tags.",
};

/** A checkbox that can also show "some selected". */
function TriStateBox({
  checked,
  mixed,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  mixed: boolean;
  disabled: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    if (ref.current) ref.current.indeterminate = mixed;
  }, [mixed]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.currentTarget.checked)}
      className="accent-accent"
    />
  );
}

export function BulkFixDrawer({
  kind,
  findingTitle,
  items,
  errors,
  busy,
  onClose,
  onApply,
}: {
  kind: FixKind;
  findingTitle: string;
  items: FixItem[];
  /** why GitLab refused a variable in the last attempt, by row id */
  errors: ReadonlyMap<string, string>;
  busy: boolean;
  onClose: () => void;
  onApply: (rows: Row[]) => void;
}) {
  const words = FIX_WORDS[kind];
  const eligible = items.filter((i) => i.problem === null);
  // Everything that can be fixed starts selected; untick what should stay as it is.
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set(eligible.map((i) => rowId(i.row))),
  );
  const blocked = items.length - eligible.length;
  const allSelected = eligible.length > 0 && selected.size === eligible.length;

  function toggle(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const apply = () => onApply(eligible.filter((i) => selected.has(rowId(i.row))).map((i) => i.row));

  return (
    <Drawer
      titleId="bulk-fix-title"
      wide
      onClose={onClose}
      title={<h2 className="text-base font-semibold text-fg">{words.verb} secrets</h2>}
      subtitle={
        <p className="mt-1 text-xs text-fg-3">
          {plural(items.length, "variable")} from "{findingTitle}"
        </p>
      }
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={apply} disabled={busy || selected.size === 0}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {words.verb} {plural(selected.size, "variable")}
          </Button>
        </div>
      }
    >
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <p className="text-sm leading-relaxed text-fg-2">{INTRO[kind]}</p>

        {kind === "protect" && (
          <div
            role="note"
            className="mt-4 flex items-start gap-2.5 rounded-lg border border-line-strong bg-surface p-3 text-[13px] leading-relaxed text-fg"
          >
            <TriangleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" aria-label="Warning" role="img" />
            <p>
              Pipelines on unprotected branches and merge requests will stop receiving these variables. If a
              feature branch pipeline relies on one, it can break.
            </p>
          </div>
        )}

        {blocked > 0 && (
          <p className="mt-4 text-[13px] leading-relaxed text-fg-2">
            {blocked === 1
              ? "1 of these can't be masked as it is."
              : `${blocked} of these can't be masked as they are.`}{" "}
            Change the value in the variable's own form first.
          </p>
        )}

        <ul className="mt-5 divide-y divide-line rounded-lg border border-line" aria-label="Variables">
          <li className="flex items-center gap-3 bg-surface px-3 py-2 text-xs text-fg-3">
            <TriStateBox
              label="Select all"
              checked={allSelected}
              mixed={selected.size > 0 && !allSelected}
              disabled={busy || eligible.length === 0}
              onChange={(on) => setSelected(new Set(on ? eligible.map((i) => rowId(i.row)) : []))}
            />
            <span>
              {selected.size} of {plural(eligible.length, "variable")} selected
            </span>
          </li>
          {items.map(({ row, problem }) => {
            const id = rowId(row);
            const error = errors.get(id);
            return (
              <li key={id} className="px-3 py-2.5">
                <label
                  className={`flex items-start gap-3 ${problem ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                >
                  <input
                    type="checkbox"
                    className="mt-1 accent-accent"
                    checked={selected.has(id)}
                    disabled={busy || problem !== null}
                    onChange={(e) => toggle(id, e.currentTarget.checked)}
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-mono text-[13px] text-fg">{row.v.key}</span>
                    <span className="block truncate text-xs text-fg-3">
                      {row.path} · {scopeLabel(row.v.environment_scope)}
                    </span>
                    {problem && <span className="mt-1 block text-xs text-fg-2">{problem}</span>}
                    {error && (
                      <span className="mt-1 block text-xs font-medium text-fg">Not changed: {error}</span>
                    )}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </Drawer>
  );
}
