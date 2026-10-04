/* Low-level GitLab REST client. Server-only: the token never reaches the browser. */

import "server-only";
import { gitlabBaseUrl } from "@/server/config";
import { HttpError } from "@/server/http";

export class GitLabError extends HttpError {}

const MAX_RETRIES = 3;
const MAX_RETRY_DELAY_MS = 30_000;

/** Delay before retrying a 429: honour Retry-After, else exponential backoff. */
export function retryDelayMs(retryAfter: string | null, attempt: number): number {
  const seconds = retryAfter === null ? NaN : Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, MAX_RETRY_DELAY_MS);
  }
  return Math.min(500 * 2 ** attempt, MAX_RETRY_DELAY_MS);
}

async function request(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const url = `${gitlabBaseUrl()}/api/v4${path}`;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      ...init,
      headers: {
        "PRIVATE-TOKEN": token,
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
      cache: "no-store",
    });
    if (res.status !== 429 || attempt >= MAX_RETRIES) return res;
    await new Promise((r) =>
      setTimeout(r, retryDelayMs(res.headers.get("retry-after"), attempt)),
    );
  }
}

async function toError(res: Response): Promise<GitLabError> {
  let message = `GitLab API ${res.status}`;
  try {
    const body = await res.json();
    const detail = body?.message ?? body?.error;
    if (typeof detail === "string") message = detail;
    else if (detail) message = JSON.stringify(detail);
  } catch {
    /* keep default */
  }
  return new GitLabError(res.status, message);
}

export async function glJson<T>(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await request(token, path, init);
  if (!res.ok) throw await toError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Follow `x-next-page` pagination and return every item. */
export async function glPaginated<T>(token: string, path: string): Promise<T[]> {
  const sep = path.includes("?") ? "&" : "?";
  const all: T[] = [];
  let page = 1;
  for (;;) {
    const res = await request(token, `${path}${sep}per_page=100&page=${page}`);
    if (!res.ok) throw await toError(res);
    all.push(...((await res.json()) as T[]));
    page = parseInt(res.headers.get("x-next-page") ?? "", 10);
    if (!Number.isFinite(page)) break;
  }
  return all;
}
