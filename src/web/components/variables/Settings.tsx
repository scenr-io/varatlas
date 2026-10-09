/* A variable's settings (protected, masked, raw, file), as chips. */

import { FileText, Lock, ShieldAlert } from "lucide-preact";
import { Chip } from "@/components/ui/Badge";
import { looksSecret } from "@/secrets";
import type { GitLabVariable } from "@shared/types";

/** The settings that matter for a variable, as chips. Exposed secrets are called out. */
export function Settings({ v }: { v: GitLabVariable }) {
  const exposed = looksSecret(v.key) && !v.masked && !v.hidden;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {exposed && (
        <Chip tone="serious" title="Looks like a secret but isn't masked: it can appear in job logs">
          <ShieldAlert className="h-3 w-3" aria-hidden="true" />
          Not masked
        </Chip>
      )}
      {v.hidden ? (
        <Chip title="Masked, and the value can't be read back">Hidden</Chip>
      ) : v.masked ? (
        <Chip title="Masked in job logs">Masked</Chip>
      ) : null}
      {v.protected && (
        <Chip tone="good" title="Only available on protected branches and tags">
          <Lock className="h-3 w-3" aria-hidden="true" />
          Protected
        </Chip>
      )}
      {v.variable_type === "file" && (
        <Chip title="Written to a file; the variable holds its path">
          <FileText className="h-3 w-3" aria-hidden="true" />
          File
        </Chip>
      )}
      {v.raw && <Chip title="$references are not expanded">Raw</Chip>}
    </div>
  );
}
