/* Bulk fixes for findings: which findings can be fixed in one go, and what each fix changes. */

import type { VariableChanges } from "@shared/types";
import { maskProblem } from "@shared/variables";
import type { Finding } from "./insights";
import type { Row } from "./rows";

export type FixKind = "mask" | "protect";

const FIXES: Record<string, FixKind | undefined> = {
  "unmasked-secrets": "mask",
  "unprotected-secrets": "protect",
};

/** The fix a finding offers, if any. */
export function fixFor(f: Finding): FixKind | null {
  return FIXES[f.id] ?? null;
}

/** Words for a fix: the button ("Mask all"), the action ("Mask") and the outcome ("Masked"). */
export const FIX_WORDS: Record<FixKind, { all: string; verb: string; done: string }> = {
  mask: { all: "Mask all", verb: "Mask", done: "Masked" },
  protect: { all: "Protect all", verb: "Protect", done: "Protected" },
};

export interface FixItem {
  row: Row;
  /** why GitLab would refuse this fix for this variable; null when it can be applied */
  problem: string | null;
}

/** What a fix would do to each variable, sorted by place and key. */
export function planFix(kind: FixKind, rows: Row[]): FixItem[] {
  return rows
    .map((row) => ({ row, problem: kind === "mask" ? maskFixProblem(row) : null }))
    .sort((a, b) => a.row.path.localeCompare(b.row.path) || a.row.v.key.localeCompare(b.row.v.key));
}

function maskFixProblem(row: Row): string | null {
  if (row.v.value === null) return "GitLab doesn't return this value, so it can't be checked.";
  return maskProblem(row.v.value, row.v.raw);
}

/** The change a fix sends to GitLab. */
export function fixChanges(kind: FixKind): VariableChanges {
  return kind === "mask" ? { masked: true } : { protected: true };
}
