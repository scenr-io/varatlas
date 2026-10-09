/* Confirmation before deleting a variable. */

import { Loader2 } from "lucide-preact";
import { Button } from "@/components/ui/Button";
import { scopePhrase } from "@/format";
import { useAutoFocus } from "@/hooks/useAutoFocus";
import { useEscape } from "@/hooks/useEscape";
import type { Row } from "@/rows";

export function DeleteDialog({
  row,
  busy,
  onCancel,
  onConfirm,
}: {
  row: Row;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useAutoFocus<HTMLButtonElement>();
  useEscape(onCancel);

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-6">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        aria-describedby="delete-detail"
        className="pop-in relative w-full max-w-md rounded-xl border border-line-strong bg-surface p-6 shadow-2xl shadow-black/60"
      >
        <h2 id="delete-title" className="text-base font-semibold text-fg">
          Delete <span className="font-mono">{row.v.key}</span>?
        </h2>
        <p id="delete-detail" className="mt-2 text-sm leading-relaxed text-fg-2">
          It will be removed from <span className="font-mono text-fg">{row.path}</span> for{" "}
          {scopePhrase(row.v.environment_scope)}.
          {row.entity === "group" ? " Every project below this group" : " Pipelines in this project"} lose it
          immediately. This can't be undone.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button ref={cancelRef} variant="ghost" onClick={onCancel}>
            Keep it
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Delete variable
          </Button>
        </div>
      </div>
    </div>
  );
}
