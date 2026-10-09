/* Rules about CI/CD variables that the server and the browser must agree on. */

import type { GitLabVariable } from "./types";

/** GitLab's rule for variable keys: letters, digits and underscores, 1 to 255 characters. */
export const KEY_PATTERN = /^[A-Za-z0-9_]{1,255}$/;

/** A variable is identified by its key and environment scope within one group or project. */
export const isSameVariable =
  (key: string, scope: string) =>
  (v: GitLabVariable): boolean =>
    v.key === key && v.environment_scope === scope;
