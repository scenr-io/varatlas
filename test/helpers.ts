/* Shared test helpers: data builders, a fake fetch, and requests to the varatlas app. */

import { vi } from "vitest";
import type { EntityType, EntityVariables, GitLabVariable } from "../src/shared/types";

const ORIGIN = "http://localhost:3131";

/** A CI/CD variable with sensible defaults; override only what the test cares about. */
export function variable(key: string, over: Partial<GitLabVariable> = {}): GitLabVariable {
  return {
    key,
    value: "v",
    variable_type: "env_var",
    protected: false,
    masked: false,
    raw: false,
    environment_scope: "*",
    description: null,
    ...over,
  };
}

/** A group or project with its variables, as the loaders return it. */
export function entity(
  kind: EntityType,
  id: number,
  path: string,
  variables: GitLabVariable[] = [],
  error?: string,
): EntityVariables {
  return {
    entity: kind,
    id,
    path,
    name: path.split("/").pop() ?? path,
    web_url: "",
    variables,
    ...(error === undefined ? {} : { error }),
  };
}

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: { "content-type": "application/json", ...(init.headers as Record<string, string> | undefined) },
  });
}

/** Replace the global fetch with `handler`. Returns the mock, for assertions on its calls. */
export function stubFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const fake = vi.fn(async (url: string, init?: RequestInit) => handler(String(url), init));
  vi.stubGlobal("fetch", fake);
  return fake;
}

/** A request to the varatlas app, with the headers its own page would send. */
export function apiRequest(
  path: string,
  init: { method?: string; headers?: Record<string, string>; body?: unknown } = {},
): Request {
  const method = init.method ?? "GET";
  const headers: Record<string, string> = { host: "localhost:3131", ...init.headers };
  if (method !== "GET") {
    headers.origin ??= ORIGIN;
    headers["content-type"] ??= "application/json";
  }
  const body =
    init.body === undefined
      ? undefined
      : typeof init.body === "string"
        ? init.body
        : JSON.stringify(init.body);
  return new Request(`${ORIGIN}${path}`, { method, headers, body });
}

/** `value`, or a clear test failure when it's missing (instead of a non-null assertion). */
export function defined<T>(value: T | null | undefined, what = "value"): T {
  if (value === null || value === undefined) throw new Error(`Expected ${what} to be defined`);
  return value;
}
