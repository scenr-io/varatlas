"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

type Toast = { id: number; kind: "ok" | "err"; text: string };

const ToastCtx = createContext<(kind: "ok" | "err", text: string) => void>(
  () => {},
);

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((kind: "ok" | "err", text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast-in pointer-events-auto flex items-center gap-2.5 rounded-xl border px-4 py-3 text-[13px] font-semibold shadow-lg backdrop-blur ${
              t.kind === "ok"
                ? "border-pass/25 bg-white/95 text-ink"
                : "border-accent/25 bg-white/95 text-ink"
            }`}
          >
            {t.kind === "ok" ? (
              <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-pass" />
            ) : (
              <XCircle className="h-4 w-4 flex-shrink-0 text-accent" />
            )}
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
