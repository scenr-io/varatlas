import { describe, expect, it } from "vitest";
import { HttpError } from "./http";
import {
  parseCreateRequest,
  parseDeleteRequest,
  parseTokenRequest,
  parseUpdateRequest,
} from "./validation";

const draft = {
  key: "API_KEY",
  value: "secret-value",
  variable_type: "env_var",
  protected: true,
  masked: true,
  raw: false,
  environment_scope: "production",
};

function rejects(fn: () => unknown) {
  expect(fn).toThrow(HttpError);
}

describe("parseCreateRequest", () => {
  it("accepts a valid request", () => {
    const r = parseCreateRequest({ entity: "project", id: 7, draft });
    expect(r).toEqual({ entity: "project", id: 7, draft });
  });

  it("rejects bad entities, ids and keys", () => {
    rejects(() => parseCreateRequest({ entity: "user", id: 7, draft }));
    rejects(() => parseCreateRequest({ entity: "group", id: -1, draft }));
    rejects(() => parseCreateRequest({ entity: "group", id: 1.5, draft }));
    rejects(() => parseCreateRequest({ entity: "group", id: 1, draft: { ...draft, key: "BAD-KEY" } }));
    rejects(() => parseCreateRequest(null));
  });

  it("drops fields it does not know", () => {
    const r = parseCreateRequest({ entity: "group", id: 1, draft: { ...draft, sneaky: 1 } });
    expect(r.draft).not.toHaveProperty("sneaky");
  });
});

describe("parseUpdateRequest", () => {
  it("keeps only provided, known changes", () => {
    const r = parseUpdateRequest({
      entity: "group",
      id: 3,
      key: "API_KEY",
      scope: "*",
      changes: { protected: false, masked_and_hidden: true, key: "RENAMED" },
    });
    expect(r.changes).toEqual({ protected: false });
  });

  it("requires a scope", () => {
    rejects(() =>
      parseUpdateRequest({ entity: "group", id: 3, key: "API_KEY", scope: " ", changes: {} }),
    );
  });
});

describe("parseDeleteRequest", () => {
  it("accepts a valid request", () => {
    expect(parseDeleteRequest({ entity: "project", id: 9, key: "A", scope: "*" })).toEqual({
      entity: "project",
      id: 9,
      key: "A",
      scope: "*",
    });
  });
});

describe("parseTokenRequest", () => {
  it("trims the token and rejects empty ones", () => {
    expect(parseTokenRequest({ token: "  glpat-x  " })).toBe("glpat-x");
    rejects(() => parseTokenRequest({ token: "   " }));
    rejects(() => parseTokenRequest({}));
  });
});
