/* Who the token belongs to, and what the token itself is allowed to do. */

import type { GitLabUser, TokenAccess } from "../../shared/types";
import { glJson } from "./client";

export async function whoAmI(token: string): Promise<GitLabUser> {
  const user = await glJson<GitLabUser>(token, "/user");
  return { username: user.username, name: user.name, avatar_url: user.avatar_url };
}

/** Scopes and expiry of the token itself, or null when GitLab can't say (OAuth, very old GitLab). */
export async function tokenAccess(token: string): Promise<TokenAccess | null> {
  try {
    const t = await glJson<{ name?: string; scopes?: string[]; expires_at?: string | null }>(
      token,
      "/personal_access_tokens/self",
    );
    return { name: t.name ?? null, scopes: t.scopes ?? null, expiresAt: t.expires_at ?? null };
  } catch {
    return null;
  }
}

/** Can this token read CI/CD variables at all? Unknown scopes get the benefit of the doubt. */
export function canReadVariables(access: TokenAccess | null): boolean {
  const scopes = access?.scopes;
  return !scopes || scopes.includes("api") || scopes.includes("read_api");
}
