/* Rules about CI/CD variables that the server and the browser must agree on. */

import type { GitLabVariable } from "./types";

/** GitLab's rule for variable keys: letters, digits and underscores, 1 to 255 characters. */
export const KEY_PATTERN = /^[A-Za-z0-9_]{1,255}$/;

/** The most updates one batch request may carry; the browser splits larger fixes. */
export const MAX_BATCH_UPDATES = 500;

/** A variable is identified by its key and environment scope within one group or project. */
export const isSameVariable =
  (key: string, scope: string) =>
  (v: GitLabVariable): boolean =>
    v.key === key && v.environment_scope === scope;

/** Characters GitLab accepts in a masked value that is expanded (not raw), besides letters and digits. */
const MASKABLE_EXPANDED = /^[A-Za-z0-9_:@\-+.~=/]*$/;

/**
 * Why GitLab would refuse to mask this value, or null when it can be masked.
 * Follows GitLab's rules: one line, no spaces, at least 8 characters, and only
 * a few symbols when the variable is expanded.
 */
export function maskProblem(value: string, raw: boolean): string | null {
  if (/[\r\n]/.test(value)) return "Masked values must be on one line.";
  if (/\s/.test(value)) return "Masked values can't contain spaces.";
  if (value.length < 8) return "Masked values need at least 8 characters.";
  if (!raw && !MASKABLE_EXPANDED.test(value)) {
    return "Expanded masked values can only use letters, digits and _ : @ - + . ~ = /";
  }
  return null;
}
