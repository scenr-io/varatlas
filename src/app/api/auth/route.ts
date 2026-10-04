import { NextResponse, type NextRequest } from "next/server";
import type { AuthStatus } from "@/lib/types";
import {
  resolveToken,
  TOKEN_COOKIE,
  TOKEN_COOKIE_OPTIONS,
} from "@/server/auth";
import { gitlabBaseUrl } from "@/server/config";
import { GitLabError } from "@/server/gitlab/client";
import { whoAmI } from "@/server/gitlab/user";
import { errorResponse, HttpError, readJson } from "@/server/http";
import { parseTokenRequest } from "@/server/validation";

/** GET /api/auth — is a working token configured, and whose is it? */
export async function GET() {
  const baseUrl = gitlabBaseUrl();
  const { token, source } = await resolveToken();
  if (!token) {
    return NextResponse.json<AuthStatus>({ configured: false, source: null, baseUrl });
  }
  try {
    const user = await whoAmI(token);
    return NextResponse.json<AuthStatus>({ configured: true, source, user, baseUrl });
  } catch {
    return NextResponse.json<AuthStatus>({ configured: false, source: null, baseUrl });
  }
}

/** POST /api/auth — validate a token against GitLab and store it in the session cookie. */
export async function POST(req: NextRequest) {
  try {
    const token = parseTokenRequest(await readJson(req));
    const user = await whoAmI(token).catch((e) => {
      if (e instanceof GitLabError && e.status === 401) {
        throw new HttpError(400, "Invalid token");
      }
      throw new HttpError(502, "Could not reach GitLab");
    });
    const res = NextResponse.json({ ok: true, user });
    res.cookies.set(TOKEN_COOKIE, token, TOKEN_COOKIE_OPTIONS);
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}

/** DELETE /api/auth — forget the session token. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(TOKEN_COOKIE);
  return res;
}
