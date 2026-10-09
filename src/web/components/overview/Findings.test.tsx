// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Finding } from "@/insights";
import { Findings } from "./Findings";

afterEach(cleanup);

const finding = (over: Partial<Finding> = {}): Finding => ({
  id: "unmasked-secrets",
  severity: "serious",
  title: "Secrets that aren't masked",
  detail: "Their values can show up in job logs.",
  rowIds: new Set(["a"]),
  count: 1,
  counts: "variables",
  unit: { one: "variable", many: "variables" },
  ...over,
});

describe("Findings", () => {
  it("says when nothing needs attention", () => {
    render(<Findings findings={[]} onOpen={vi.fn()} />);
    expect(screen.getByText("Nothing needs attention here")).toBeTruthy();
  });

  it("uses the singular unit for one", () => {
    render(<Findings findings={[finding()]} onOpen={vi.fn()} />);
    expect(screen.getByRole("button").getAttribute("aria-label")).toBe(
      "Secrets that aren't masked: 1 variable. Show them.",
    );
  });

  it("opens the variables behind a finding", () => {
    const onOpen = vi.fn();
    const f = finding({ count: 3, rowIds: new Set(["a", "b", "c"]) });
    render(<Findings findings={[f]} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: /3 variables/ }));
    expect(onOpen).toHaveBeenCalledWith(f);
  });

  it("lists places for findings without variables to open", () => {
    const f = finding({
      id: "unreadable",
      severity: "warning",
      title: "Places varatlas can't read",
      counts: "places",
      rowIds: new Set(),
      count: 2,
      unit: { one: "group or project", many: "groups and projects" },
      paths: ["acme/a", "acme/b"],
    });
    render(<Findings findings={[f]} onOpen={vi.fn()} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("acme/a, acme/b")).toBeTruthy();
  });
});
