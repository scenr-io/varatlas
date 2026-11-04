import { describe, expect, it } from "vitest";
import type { Finding } from "./insights";
import type { Row } from "./rows";
import { fixChanges, fixFor, planFix } from "./fixes";
import { variable } from "../../test/helpers";

const row = (key: string, path: string, over: Parameters<typeof variable>[1] = {}): Row => ({
  entity: "project",
  entityId: 1,
  path,
  web_url: "",
  v: variable(key, over),
});

const finding = (id: string) => ({ id }) as Finding;

describe("fixFor", () => {
  it("offers a fix only for the secrets findings", () => {
    expect(fixFor(finding("unmasked-secrets"))).toBe("mask");
    expect(fixFor(finding("unprotected-secrets"))).toBe("protect");
    expect(fixFor(finding("drift"))).toBeNull();
  });
});

describe("planFix", () => {
  it("flags values GitLab won't mask and sorts by place and key", () => {
    const plan = planFix("mask", [
      row("TOKEN", "acme/b", { value: "long-enough-value" }),
      row("API_KEY", "acme/b", { value: "short" }),
      row("SECRET", "acme/a", { value: null, hidden: true }),
    ]);
    expect(plan.map((i) => i.row.v.key)).toEqual(["SECRET", "API_KEY", "TOKEN"]);
    expect(plan.map((i) => i.problem === null)).toEqual([false, false, true]);
  });

  it("can always protect", () => {
    expect(planFix("protect", [row("API_KEY", "acme", { value: "x" })])[0]?.problem).toBeNull();
  });
});

describe("fixChanges", () => {
  it("changes only the one attribute", () => {
    expect(fixChanges("mask")).toEqual({ masked: true });
    expect(fixChanges("protect")).toEqual({ protected: true });
  });
});
