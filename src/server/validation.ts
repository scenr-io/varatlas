/*
 * Validation for API request bodies. Only known fields are forwarded to GitLab,
 * so a request can never smuggle extra parameters through to the GitLab API.
 */

import type {
  CreateVariableRequest,
  DeleteVariableRequest,
  EntityRef,
  UpdateVariableRequest,
  VariableChanges,
  VariableDraft,
} from "../shared/types";
import { HttpError } from "./http";

const KEY_PATTERN = /^[A-Za-z0-9_]{1,255}$/;

type Obj = Record<string, unknown>;

function fail(message: string): never {
  throw new HttpError(400, message);
}

function asObject(v: unknown, name: string): Obj {
  if (typeof v !== "object" || v === null || Array.isArray(v)) {
    fail(`${name} must be an object`);
  }
  return v as Obj;
}

function str(o: Obj, field: string): string {
  if (typeof o[field] !== "string") fail(`${field} must be a string`);
  return o[field] as string;
}

function bool(o: Obj, field: string): boolean {
  if (typeof o[field] !== "boolean") fail(`${field} must be a boolean`);
  return o[field] as boolean;
}

function parseKey(o: Obj): string {
  const key = str(o, "key");
  if (!KEY_PATTERN.test(key)) {
    fail("key must be 1-255 letters, digits or underscores");
  }
  return key;
}

function parseScope(o: Obj, field: string): string {
  const scope = str(o, field).trim();
  if (!scope) fail(`${field} must not be empty`);
  return scope;
}

function parseVariableType(o: Obj): VariableDraft["variable_type"] {
  const t = o.variable_type;
  if (t !== "env_var" && t !== "file") {
    fail("variable_type must be env_var or file");
  }
  return t;
}

function parseRef(o: Obj): EntityRef {
  if (o.entity !== "group" && o.entity !== "project") {
    fail("entity must be group or project");
  }
  if (typeof o.id !== "number" || !Number.isInteger(o.id) || o.id <= 0) {
    fail("id must be a positive integer");
  }
  return { entity: o.entity, id: o.id };
}

function parseDraft(v: unknown): VariableDraft {
  const o = asObject(v, "draft");
  const draft: VariableDraft = {
    key: parseKey(o),
    value: str(o, "value"),
    variable_type: parseVariableType(o),
    protected: bool(o, "protected"),
    masked: bool(o, "masked"),
    raw: bool(o, "raw"),
    environment_scope: parseScope(o, "environment_scope"),
  };
  if (o.masked_and_hidden !== undefined) {
    draft.masked_and_hidden = bool(o, "masked_and_hidden");
  }
  if (o.description !== undefined) draft.description = str(o, "description");
  return draft;
}

function parseChanges(v: unknown): VariableChanges {
  const o = asObject(v, "changes");
  const changes: VariableChanges = {};
  if (o.value !== undefined) changes.value = str(o, "value");
  if (o.variable_type !== undefined) changes.variable_type = parseVariableType(o);
  if (o.protected !== undefined) changes.protected = bool(o, "protected");
  if (o.masked !== undefined) changes.masked = bool(o, "masked");
  if (o.raw !== undefined) changes.raw = bool(o, "raw");
  if (o.environment_scope !== undefined) {
    changes.environment_scope = parseScope(o, "environment_scope");
  }
  if (o.description !== undefined) changes.description = str(o, "description");
  return changes;
}

export function parseCreateRequest(body: unknown): CreateVariableRequest {
  const o = asObject(body, "body");
  return { ...parseRef(o), draft: parseDraft(o.draft) };
}

export function parseUpdateRequest(body: unknown): UpdateVariableRequest {
  const o = asObject(body, "body");
  return {
    ...parseRef(o),
    key: parseKey(o),
    scope: parseScope(o, "scope"),
    changes: parseChanges(o.changes),
  };
}

export function parseDeleteRequest(body: unknown): DeleteVariableRequest {
  const o = asObject(body, "body");
  return { ...parseRef(o), key: parseKey(o), scope: parseScope(o, "scope") };
}

export function parseTokenRequest(body: unknown): string {
  const o = asObject(body, "body");
  const token = typeof o.token === "string" ? o.token.trim() : "";
  if (!token) fail("Token is required");
  return token;
}
