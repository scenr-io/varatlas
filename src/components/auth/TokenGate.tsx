"use client";

import { useState } from "react";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { ScenrCredit } from "@/components/ui/ScenrCredit";
import { api } from "@/lib/api";

export default function TokenGate({
  baseUrl,
  onConnected,
}: {
  baseUrl: string;
  onConnected: () => void;
}) {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.connect(token);
      onConnected();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not validate the token");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid-bg flex min-h-screen items-center justify-center bg-night-3 p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="font-mono text-[10px] font-bold tracking-[0.24em] text-white/35">
            <span className="text-brand">/</span> GITLAB CI/CD VARIABLES
          </p>
          <h1 className="font-display mt-3 text-5xl text-white">varatlas</h1>
          <p className="mt-2 text-[13px] font-medium text-white/45">
            Every CI/CD variable across your GitLab org, in one place
          </p>
        </div>

        <form onSubmit={submit} className="rounded-2xl border border-white/[0.08] bg-night-2 p-6">
          <label
            htmlFor="token"
            className="mb-2 flex items-center gap-2 font-mono text-[10px] font-bold tracking-[0.18em] text-white/45"
          >
            <KeyRound className="h-3.5 w-3.5 text-brand" />
            PERSONAL ACCESS TOKEN
          </label>
          <input
            id="token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="glpat-…"
            autoFocus
            autoComplete="off"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 font-mono text-[13px] text-white placeholder:text-white/25 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/15"
          />
          {error && <p className="mt-2 text-[12px] font-semibold text-accent-soft">{error}</p>}
          <button
            type="submit"
            disabled={busy || !token.trim()}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-[13px] font-bold text-white transition-colors hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? "Validating…" : "Connect to GitLab"}
          </button>

          <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-pass" />
            <p className="text-[11.5px] leading-relaxed text-white/40">
              Needs the <span className="font-mono text-white/60">api</span> scope (
              <span className="font-mono text-white/60">read_api</span> for read-only). Kept in an
              httpOnly cookie and used server-side only — never exposed to the browser. Groups and
              projects are discovered automatically from the token.
            </p>
          </div>
        </form>

        <div className="mt-6 flex items-center justify-center gap-3 font-mono text-[9px] tracking-[0.2em] text-white/25">
          <span>{new URL(baseUrl).host.toUpperCase()} · API V4</span>
          <span aria-hidden>·</span>
          <ScenrCredit className="text-white/25 hover:text-white/50" />
        </div>
      </div>
    </div>
  );
}
