
import { useEffect } from "preact/hooks";
import { useAutoFocus } from "@/hooks/useAutoFocus";
import { Loader2 } from "lucide-preact";
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

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-6">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onCancel} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        className="toast-in relative w-full max-w-sm rounded-2xl border border-black/[0.08] bg-paper p-6 shadow-2xl"
      >
        <p
          id="delete-title"
          className="font-mono text-[9px] font-bold tracking-[0.2em] text-accent"
        >
          / DELETE VARIABLE
        </p>
        <p className="mt-3 text-[14px] leading-relaxed text-ink/70">
          Delete <span className="font-mono font-bold text-ink">{row.v.key}</span>{" "}
          (scope <span className="font-mono">{row.v.environment_scope}</span>) from{" "}
          <span className="font-mono text-[12.5px]">{row.path}</span>? Pipelines using it
          will lose access immediately.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <button
            onClick={onCancel}
            ref={cancelRef}
            className="rounded-xl px-4 py-2 text-[13px] font-semibold text-ink/55 hover:bg-black/5"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-[13px] font-bold text-white hover:bg-accent-soft disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
