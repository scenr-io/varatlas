import { AlertTriangle } from "lucide-preact";
import type { EntityVariables } from "@shared/types";

const SHOWN = 4;

/** Lists groups/projects whose variables could not be read. */
export function AccessWarning({ errored }: { errored: EntityVariables[] }) {
  if (errored.length === 0) return null;
  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-warn/25 bg-warn/[0.06] px-4 py-3">
      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-warn" />
      <p className="text-[12px] leading-relaxed text-ink/60">
        Couldn&apos;t read variables from {errored.length}{" "}
        {errored.length === 1 ? "group or project" : "groups and projects"} (needs
        Maintainer):{" "}
        <span className="font-mono text-[11px]">
          {errored
            .slice(0, SHOWN)
            .map((e) => e.path)
            .join(", ")}
          {errored.length > SHOWN && ` +${errored.length - SHOWN} more`}
        </span>
      </p>
    </div>
  );
}
