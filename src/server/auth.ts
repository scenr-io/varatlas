/* Which GitLab token to use: GITLAB_TOKEN from the environment, else the session cookie. */

import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { TokenSource } from "../shared/types";
import { HttpError } from "./http";

export const TOKEN_COOKIE = "varatlas_token";
const THIRTY_DAYS = 60 * 60 * 24 * 30;

export function resolveToken(c: Context): {
  token: string | null;
  source: TokenSource | null;
} {
  if (process.env.GITLAB_TOKEN) {
    return { token: process.env.GITLAB_TOKEN, source: "env" };
  }
  const cookie = getCookie(c, TOKEN_COOKIE);
  if (cookie) return { token: cookie, source: "cookie" };
  return { token: null, source: null };
}

export function requireToken(c: Context): string {
  const { token } = resolveToken(c);
  if (!token) throw new HttpError(401, "No GitLab token configured");
  return token;
}

function isHttps(c: Context): boolean {
  return (
    new URL(c.req.url).protocol === "https:" ||
    c.req.header("x-forwarded-proto") === "https"
  );
}

export function setTokenCookie(c: Context, token: string) {
  setCookie(c, TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: "Strict",
    secure: isHttps(c),
    maxAge: THIRTY_DAYS,
    path: "/",
  });
}

export function clearTokenCookie(c: Context) {
  deleteCookie(c, TOKEN_COOKIE, { path: "/" });
}
