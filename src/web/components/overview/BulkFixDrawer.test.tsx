// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { planFix, type FixKind } from "@/fixes";
import type { Row } from "@/rows";
import { variable } from "../../../../test/helpers";
import { BulkFixDrawer } from "./BulkFixDrawer";

afterEach(cleanup);

const row = (key: string, value: string): Row => ({
  entity: "project",
  entityId: 1,
  path: "acme/api",
  web_url: "",
  v: variable(key, { value }),
});

const rows = [row("API_KEY", "long-enough-1"), row("DB_PASSWORD", "long-enough-2"), row("TOKEN", "short")];

function open(kind: FixKind = "mask", errors = new Map<string, string>()) {
  const onApply = vi.fn();
  render(
    <BulkFixDrawer
      kind={kind}
      findingTitle="Secrets that aren't masked"
      items={planFix(kind, rows)}
      errors={errors}
      busy={false}
      onClose={vi.fn()}
      onApply={onApply}
    />,
  );
  return onApply;
}

const selectAll = () => screen.getByRole<HTMLInputElement>("checkbox", { name: "Select all" });
const box = (key: string) =>
  screen.getByText(key).closest("label")?.querySelector("input") as HTMLInputElement;

describe("BulkFixDrawer", () => {
  it("selects every variable GitLab can mask, and flags the rest", () => {
    open();
    expect(selectAll().checked).toBe(true);
    expect(box("API_KEY").checked).toBe(true);
    expect(box("TOKEN").checked).toBe(false);
    expect(box("TOKEN").disabled).toBe(true);
    expect(screen.getByText("Masked values need at least 8 characters.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mask 2 variables" })).toBeTruthy();
  });

  it("applies only the variables left ticked", () => {
    const onApply = open();
    fireEvent.click(box("API_KEY"));
    expect(selectAll().indeterminate).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Mask 1 variable" }));
    expect(onApply.mock.calls[0]?.[0].map((r: Row) => r.v.key)).toEqual(["DB_PASSWORD"]);
  });

  it("clears and restores the selection from the header box", () => {
    open();
    fireEvent.click(selectAll());
    expect(box("API_KEY").checked).toBe(false);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Mask 0 variables" }).disabled).toBe(true);
    fireEvent.click(selectAll());
    expect(box("DB_PASSWORD").checked).toBe(true);
  });

  it("warns what protecting breaks", () => {
    open("protect");
    expect(screen.getByRole("note").textContent).toMatch(/unprotected branches and merge requests/);
    expect(screen.getByRole("button", { name: "Protect 3 variables" })).toBeTruthy();
  });

  it("shows why GitLab refused a variable last time", () => {
    open("mask", new Map([["project:1:API_KEY:*", "Insufficient permissions"]]));
    expect(screen.getByText("Not changed: Insufficient permissions")).toBeTruthy();
  });
});
