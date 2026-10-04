import { useEffect, useState } from "preact/hooks";

function ago(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}

/** "Synced 3 min ago", "Syncing…", or a refresh error. Re-renders every 30 s to stay current. */
export function SyncStatus({
  syncedAt,
  refreshing,
  error,
}: {
  syncedAt: number | null;
  refreshing: boolean;
  error: string | null;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (error) {
    return (
      <p className="text-xs text-warning" title={error}>
        Reload failed
      </p>
    );
  }
  if (refreshing) return <p className="text-xs text-fg-3">Syncing…</p>;
  if (syncedAt === null) return null;
  return (
    <p className="hidden text-xs text-fg-3 sm:block" title={new Date(syncedAt).toLocaleString()}>
      Synced {ago(Math.max(0, now - syncedAt))}
    </p>
  );
}
