/* Typed browser client for the varatlas API. */

import type {
  AuthStatus,
  CreateVariableRequest,
  DeleteVariableRequest,
  GitLabVariable,
  OrgVariables,
  UpdateVariableRequest,
} from "@shared/types";

async function call<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    // The API rejects state-changing requests that are not JSON.
    headers: method === "GET" ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = typeof data === "object" && data !== null && "error" in data ? data.error : undefined;
    throw new Error(typeof error === "string" && error ? error : `Request failed (${res.status})`);
  }
  // Our own server's response; its shape is defined by the shared types.
  return data as T;
}

export const api = {
  authStatus: () => call<AuthStatus>("/api/auth"),
  connect: (token: string) => call<{ ok: true }>("/api/auth", "POST", { token }),
  disconnect: () => call<{ ok: true }>("/api/auth", "DELETE"),

  /** The server's cached snapshot, or a fresh load from GitLab when `refresh` is set. */
  loadAll: (refresh = false) => call<OrgVariables>(refresh ? "/api/variables?refresh=1" : "/api/variables"),
  create: (req: CreateVariableRequest) => call<{ variable: GitLabVariable }>("/api/variables", "POST", req),
  update: (req: UpdateVariableRequest) => call<{ variable: GitLabVariable }>("/api/variables", "PUT", req),
  remove: (req: DeleteVariableRequest) => call<{ ok: true }>("/api/variables", "DELETE", req),
};
