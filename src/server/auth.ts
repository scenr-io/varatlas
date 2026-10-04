/* Which GitLab token to use: GITLAB_TOKEN from the environment, else the session cookie. */

import "server-only";
import { cookies } from "next/headers";
import type { TokenSource } from "@/lib/types";
import { HttpError } from "@/server/http";

export const TOKEN_COOKIE = "varatlas_token";

export const TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "strict",
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 30,
  path: "/",
} as const;

export async function resolveToken(): Promise<{
  token: string | null;
  source: TokenSource | null;
}> {
  if (process.env.GITLAB_TOKEN) {
    return { token: process.env.GITLAB_TOKEN, source: "env" };
  }
  const cookie = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (cookie) return { token: cookie, source: "cookie" };
  return { token: null, source: null };
}

export async function requireToken(): Promise<string> {
  const { token } = await resolveToken();
  if (!token) throw new HttpError(401, "No GitLab token configured");
  return token;
}
