// @vitest-environment happy-dom
/*
 * Integration: the real Workspace (every view, panel and hook) rendered against the
 * demo org's data, with the data hook's actions faked.
 */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/preact";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { demoOrg } from "../../src/server/demo";
import { Workspace } from "../../src/web/components/Workspace";
import { authStatus, defined, fakeOrg } from "../helpers";

beforeAll(() => {
  history.replaceState(null, "", "/#overview");
});
afterEach(() => {
  cleanup();
  history.replaceState(null, "", "/#overview");
});

function renderWorkspace(over: Parameters<typeof fakeOrg>[0] = {}) {
  const { tree, entities } = demoOrg();
  const org = fakeOrg({ auth: authStatus({ demo: true }), tree, entities, syncedAt: Date.now(), ...over });
  render(<Workspace org={org} auth={org.auth ?? authStatus()} />);
  return org;
}

const view = (name: "Overview" | "Variables") =>
  fireEvent.click(within(screen.getByRole("navigation", { name: "Views" })).getByRole("button", { name }));

describe("Workspace", () => {
  it("shows the overview: headline, findings, atlas and breakdowns", () => {
    renderWorkspace();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "41 variables in 16 of 20 groups and projects",
    );
    expect(screen.getByText("Same key, different values")).toBeTruthy();
    expect(screen.getByRole("list", { name: "Variables per group" })).toBeTruthy();
    expect(screen.getByText("Masked in job logs")).toBeTruthy();
    expect(screen.getByText("Demo mode.")).toBeTruthy();
  });

  it("scopes everything to a selected project", () => {
    renderWorkspace();
    fireEvent.click(
      defined(
        screen.getAllByRole("treeitem").find((t) => t.textContent?.startsWith("payments-api")),
        "payments-api tree item",
      ),
    );
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("payments-api receives 13 variables");
    expect(screen.getByRole("heading", { name: "Where this project's variables come from" })).toBeTruthy();
    view("Variables");
    expect(screen.getByText("Showing 13 of 13 variables, including what this project inherits")).toBeTruthy();
  });

  it("filters the table by a finding, then by key", () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: /Secrets that aren't masked/ }));
    expect(screen.getByText("Showing 2 of 41 variables")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "By key" }));
    expect(screen.getByText("Showing 2 keys")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear finding filter" }));
    expect(screen.getByText(/Showing \d+ keys/)).toBeTruthy();
  });

  it("opens a key's detail with every copy", () => {
    renderWorkspace();
    view("Variables");
    fireEvent.input(screen.getByLabelText("Search variables"), { target: { value: "DATABASE_URL" } });
    fireEvent.click(defined(screen.getAllByRole("button", { name: "DATABASE_URL" })[0], "DATABASE_URL row"));
    const panel = screen.getByRole("dialog", { name: "DATABASE_URL" });
    expect(within(panel).getByText(/The copies hold different values/)).toBeTruthy();
  });

  it("opens the add form and the delete confirmation", () => {
    renderWorkspace();
    fireEvent.click(within(screen.getByRole("banner")).getByRole("button", { name: /Add variable/ }));
    expect(screen.getByRole("dialog", { name: "Add a variable" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    view("Variables");
    fireEvent.click(defined(screen.getAllByRole("button", { name: /^Delete / })[0], "a delete button"));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Keep it" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("hides editing for a read-only token", () => {
    renderWorkspace({ auth: authStatus({ token: { name: "t", scopes: ["read_api"], expiresAt: null } }) });
    expect(screen.getByText("Read-only token.")).toBeTruthy();
    expect(within(screen.getByRole("banner")).queryByRole("button", { name: /Add variable/ })).toBeNull();
  });
});
