import type { ComponentChildren } from "preact";
import { ShieldAlert } from "lucide-preact";
import { Chip } from "@/components/ui/Badge";
import type { KeySummary } from "@/insights";
import { Centered } from "./VariableTable";

const VALUES = {
  same: { tone: "neutral", label: "Same value" },
  different: { tone: "warning", label: "Values differ" },
  unreadable: { tone: "neutral", label: "Hidden values" },
} as const;

/** One row per key: where it lives and whether its copies agree. Opens the key's detail. */
export function KeyTable({
  keys,
  onOpen,
  empty,
}: {
  keys: KeySummary[];
  onOpen: (key: string) => void;
  empty: ComponentChildren;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-t-xl border border-b-0 border-line bg-surface">
      {keys.length === 0 ? (
        <Centered>{empty}</Centered>
      ) : (
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-surface">
            <tr className="h-9 border-b border-line">
              {["Key", "Places", "Environments", "Values", "Protection"].map((h) => (
                <th key={h} scope="col" className="whitespace-nowrap px-4 text-xs font-medium text-fg-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => {
              const exposed = k.secret && !k.maskedAll;
              return (
                <tr
                  key={k.key}
                  onClick={() => onOpen(k.key)}
                  className="h-12 cursor-pointer border-b border-line transition-colors hover:bg-raised/50"
                >
                  <td className="max-w-[320px] px-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpen(k.key);
                      }}
                      className="block max-w-full truncate text-left font-mono text-[13px] font-medium text-fg hover:text-accent"
                    >
                      {k.key}
                    </button>
                  </td>
                  <td className="px-4 text-sm tabular-nums text-fg-2">{k.locations}</td>
                  <td className="max-w-[220px] truncate px-4 font-mono text-xs text-fg-2">
                    {k.scopes.map((s) => (s === "*" ? "* (all)" : s)).join(", ")}
                  </td>
                  <td className="px-4">
                    {k.locations > 1 || k.values === "unreadable" ? (
                      <Chip tone={VALUES[k.values].tone}>{VALUES[k.values].label}</Chip>
                    ) : (
                      <span className="text-xs text-fg-3">One place</span>
                    )}
                  </td>
                  <td className="px-4">
                    <div className="flex flex-wrap gap-1">
                      {exposed && (
                        <Chip tone="serious" title="Looks like a secret but isn't masked everywhere">
                          <ShieldAlert className="h-3 w-3" aria-hidden="true" />
                          {k.locations > 1 ? "Not masked everywhere" : "Not masked"}
                        </Chip>
                      )}
                      {k.maskedAll && <Chip>Masked</Chip>}
                      {k.protectedAll && <Chip tone="good">Protected</Chip>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
