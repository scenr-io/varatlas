/* Typed browser client for the varatlas API routes. */

import type {
  AuthStatus,
  CreateVariableRequest,
  DeleteVariableRequest,
  GitLabVariable,
  OrgVariables,
  UpdateVariableRequest,
} from "./types";

async function call<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    // The API rejects state-changing requests that are not JSON.
    headers: method === "GET" ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  authStatus: () => call<AuthStatus>("/api/auth"),
  connect: (token: string) => call<{ ok: true }>("/api/auth", "POST", { token }),
  disconnect: () => call<{ ok: true }>("/api/auth", "DELETE"),

  loadAll: () => call<OrgVariables>("/api/variables"),
  create: (req: CreateVariableRequest) =>
    call<{ variable: GitLabVariable }>("/api/variables", "POST", req),
  update: (req: UpdateVariableRequest) =>
    call<{ variable: GitLabVariable }>("/api/variables", "PUT", req),
  remove: (req: DeleteVariableRequest) =>
    call<{ ok: true }>("/api/variables", "DELETE", req),
};
