import { useEffect } from "preact/hooks";
import { Loader2 } from "lucide-preact";
import { useAutoFocus } from "@/hooks/useAutoFocus";
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const scope = row.v.environment_scope === "*" ? "all environments" : `the ${row.v.environment_scope} environment`;

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
          It will be removed from <span className="font-mono text-fg">{row.path}</span> for {scope}.
          {row.entity === "group" ? " Every project below this group" : " Pipelines in this project"} lose it
          immediately. This can't be undone.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-medium text-fg-2 hover:bg-raised hover:text-fg"
          >
            Keep it
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="flex items-center gap-2 rounded-lg bg-fg px-4 py-2 text-sm font-semibold text-page hover:opacity-90 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Delete variable
          </button>
        </div>
      </div>
    </div>
  );
}
