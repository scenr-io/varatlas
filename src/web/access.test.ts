import { describe, expect, it } from "vitest";
import type { AuthStatus, EntityVariables } from "@shared/types";
import { accessState, expiresInDays, newTokenUrl } from "./access";

const auth = (scopes: string[] | null, expiresAt: string | null = null): AuthStatus => ({
  configured: true,
  source: "env",
  baseUrl: "https://gitlab.com",
  token: { name: "t", scopes, expiresAt },
});

const ent = (path: string, error?: string): EntityVariables => ({
  entity: "project",
  id: path.length,
  path,
  name: path,
  web_url: "",
  variables: [],
  error,
});

const NOW = Date.parse("2026-10-04T12:00:00Z");

describe("accessState", () => {
  it("is fine and writable with the api scope", () => {
    expect(accessState(auth(["api"]), [ent("a")], NOW)).toEqual({
      kind: "ok",
      readOnly: false,
      expiresInDays: null,
    });
  });

  it("is read-only with read_api only", () => {
    expect(accessState(auth(["read_api", "read_user"]), [ent("a")], NOW)).toMatchObject({ readOnly: true });
  });

  it("assumes write access when scopes are unknown", () => {
    expect(accessState(auth(null), [ent("a")], NOW)).toMatchObject({ readOnly: false });
  });

  it("detects an account in no groups", () => {
    expect(accessState(auth(["api"]), [], NOW)).toEqual({ kind: "no-groups" });
  });

  it("detects a role below Maintainer everywhere", () => {
    expect(accessState(auth(["api"]), [ent("a", "x"), ent("b", "x")], NOW)).toEqual({
      kind: "no-role",
      paths: ["a", "b"],
    });
  });

  it("stays ok while anything at all is readable", () => {
    expect(accessState(auth(["api"]), [ent("a", "x"), ent("b")], NOW).kind).toBe("ok");
  });

  it("waits for data before judging roles", () => {
    expect(accessState(auth(["api"]), null, NOW).kind).toBe("ok");
  });
});

describe("expiresInDays", () => {
  it("warns within two weeks, counting the expiry day itself", () => {
    expect(expiresInDays("2026-10-04", NOW)).toBe(1);
    expect(expiresInDays("2026-10-10", NOW)).toBe(7);
    expect(expiresInDays("2026-11-30", NOW)).toBeNull();
    expect(expiresInDays(null, NOW)).toBeNull();
  });
});

describe("newTokenUrl", () => {
  it("pre-fills GitLab's token form", () => {
    expect(newTokenUrl("https://git.example.com", "read_api")).toBe(
      "https://git.example.com/-/user_settings/personal_access_tokens?name=varatlas&scopes=read_api",
    );
  });
});
