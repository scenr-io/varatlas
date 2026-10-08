import { useState } from "preact/hooks";
import { KeyRound, Loader2, ShieldCheck } from "lucide-preact";
import { ScenrCredit } from "@/components/ui/ScenrCredit";
import { useAutoFocus } from "@/hooks/useAutoFocus";
import { api } from "@/api";

export default function TokenGate({
  baseUrl,
  onConnected,
  notice,
}: {
  baseUrl: string;
  onConnected: () => void;
  /** shown above the form, e.g. when a saved token stopped working */
  notice?: string;
}) {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useAutoFocus<HTMLInputElement>();
  const [error, setError] = useState<string | null>(null);

  async function submit(e: Event) {
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
    <main className="flex min-h-screen items-center justify-center bg-page px-4 py-10">
      <div className="w-full max-w-[400px]">
        <h1 className="font-display text-5xl leading-none text-fg">varatlas</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-fg-2">
          Every CI/CD variable in your GitLab org, on one map: where it's defined, what each
          project inherits, and what needs fixing.
        </p>

        {notice && (
          <p className="mt-6 rounded-lg border border-line-strong px-4 py-3 text-sm leading-relaxed text-fg" role="alert">
            {notice}
          </p>
        )}

        <form onSubmit={submit} className="mt-8 rounded-xl border border-line bg-surface p-5">
          <label htmlFor="token" className="mb-2 flex items-center gap-2 text-sm font-medium text-fg">
            <KeyRound className="h-4 w-4 text-accent" aria-hidden="true" />
            Personal access token
          </label>
          <input
            id="token"
            ref={inputRef}
            type="password"
            value={token}
            onInput={(e) => setToken(e.currentTarget.value)}
            placeholder="glpat-…"
            autocomplete="off"
            className="field w-full font-mono text-sm"
          />
          {error && (
            <p className="mt-2 text-sm text-serious" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy || !token.trim()}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {busy ? "Checking token…" : "Connect to GitLab"}
          </button>

          <p className="mt-4 flex items-start gap-2 text-[13px] leading-relaxed text-fg-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-good" aria-hidden="true" />
            <span>
              Use the <code className="font-mono text-fg-2">api</code> scope, or{" "}
              <code className="font-mono text-fg-2">read_api</code> to browse without editing. The token
              stays on this server in an httpOnly cookie.
            </span>
          </p>
        </form>

        <div className="mt-5 flex items-center justify-between text-xs text-fg-3">
          <span>Connecting to {new URL(baseUrl).host}</span>
          <ScenrCredit />
        </div>
      </div>
    </main>
  );
}
