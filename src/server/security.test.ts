import { describe, expect, it } from "vitest";
import { checkApiRequest, hostnameOf } from "./security";

const ALLOWED = ["localhost", "127.0.0.1", "::1"];

function req(method: string, headers: Record<string, string>) {
  return { method, headers: new Headers(headers) };
}

describe("hostnameOf", () => {
  it("strips the port", () => {
    expect(hostnameOf("localhost:3131")).toBe("localhost");
    expect(hostnameOf("127.0.0.1")).toBe("127.0.0.1");
  });

  it("handles bracketed IPv6", () => {
    expect(hostnameOf("[::1]:3131")).toBe("::1");
  });

  it("returns null for missing or malformed hosts", () => {
    expect(hostnameOf(null)).toBeNull();
    expect(hostnameOf("[")).toBeNull();
  });
});

describe("checkApiRequest", () => {
  it("allows reads from an allowed host", () => {
    expect(checkApiRequest(req("GET", { host: "localhost:3131" }), ALLOWED)).toEqual({ ok: true });
  });

  it("blocks unknown hosts, including DNS-rebinding domains", () => {
    const v = checkApiRequest(req("GET", { host: "attacker.example:3131" }), ALLOWED);
    expect(v).toMatchObject({ ok: false, status: 403 });
  });

  it("allows same-origin JSON mutations", () => {
    const v = checkApiRequest(
      req("POST", {
        host: "localhost:3131",
        origin: "http://localhost:3131",
        "content-type": "application/json",
      }),
      ALLOWED,
    );
    expect(v).toEqual({ ok: true });
  });

  it("blocks cross-origin mutations", () => {
    const v = checkApiRequest(
      req("DELETE", {
        host: "localhost:3131",
        origin: "https://evil.example",
        "content-type": "application/json",
      }),
      ALLOWED,
    );
    expect(v).toMatchObject({ ok: false, status: 403 });
  });

  it("blocks mutations without an Origin header", () => {
    const v = checkApiRequest(
      req("PUT", { host: "localhost:3131", "content-type": "application/json" }),
      ALLOWED,
    );
    expect(v).toMatchObject({ ok: false, status: 403 });
  });

  it("blocks text/plain POSTs that skip CORS preflight", () => {
    const v = checkApiRequest(
      req("POST", {
        host: "localhost:3131",
        origin: "http://localhost:3131",
        "content-type": "text/plain",
      }),
      ALLOWED,
    );
    expect(v).toMatchObject({ ok: false, status: 415 });
  });
});
