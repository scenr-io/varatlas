import { createContext, type ComponentChildren } from "preact";
import { useCallback, useContext, useState } from "preact/hooks";
import { CircleCheck, CircleX } from "lucide-preact";

type Toast = { id: number; kind: "ok" | "err"; text: string };

const ToastCtx = createContext<(kind: "ok" | "err", text: string) => void>(() => {});

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: ComponentChildren }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((kind: "ok" | "err", text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "err" ? 7000 : 4000);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div
        className="pointer-events-none fixed bottom-5 right-5 z-[100] flex flex-col gap-2"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pop-in pointer-events-auto flex max-w-sm items-start gap-2.5 rounded-lg border border-line-strong bg-raised px-4 py-3 text-sm text-fg shadow-xl shadow-black/40"
          >
            {t.kind === "ok" ? (
              <CircleCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-good" aria-label="Done" role="img" />
            ) : (
              <CircleX className="mt-0.5 h-4 w-4 flex-shrink-0 text-critical" aria-label="Error" role="img" />
            )}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
