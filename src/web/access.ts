/* What the connected token can do, derived from GitLab's answer and the loaded snapshot. */

import type { AuthStatus, EntityVariables } from "@shared/types";

const DAY = 24 * 60 * 60 * 1000;
/** Warn about expiry this many days ahead. */
const EXPIRY_WARNING_DAYS = 14;

export type AccessState =
  /** everything is fine; maybe read-only, maybe expiring soon */
  | { kind: "ok"; readOnly: boolean; expiresInDays: number | null }
  /** the account isn't a member of any group */
  | { kind: "no-groups" }
  /** groups are visible, but the role is below Maintainer everywhere */
  | { kind: "no-role"; paths: string[] };

/** Days until the token expires, if that's within the warning window. */
export function expiresInDays(expiresAt: string | null | undefined, now = Date.now()): number | null {
  if (!expiresAt) return null;
  // GitLab expiry dates are whole days; a token stops working at the end of that day (UTC).
  const days = Math.ceil((Date.parse(`${expiresAt.slice(0, 10)}T23:59:59Z`) - now) / DAY);
  return days <= EXPIRY_WARNING_DAYS ? Math.max(days, 0) : null;
}

export function accessState(
  auth: AuthStatus,
  entities: EntityVariables[] | null,
  now = Date.now(),
): AccessState {
  if (entities && entities.length === 0) return { kind: "no-groups" };
  if (entities && entities.every((e) => e.error)) {
    return { kind: "no-role", paths: entities.map((e) => e.path) };
  }
  const scopes = auth.token?.scopes;
  return {
    kind: "ok",
    readOnly: !!scopes && !scopes.includes("api"),
    expiresInDays: expiresInDays(auth.token?.expiresAt, now),
  };
}

/** GitLab's "new personal access token" page, pre-filled with a name and scope. */
export function newTokenUrl(baseUrl: string, scope: "api" | "read_api" = "api"): string {
  return `${baseUrl}/-/user_settings/personal_access_tokens?name=varatlas&scopes=${scope}`;
}
