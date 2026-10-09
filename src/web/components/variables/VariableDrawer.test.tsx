// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OrgTree } from "@shared/types";
import { variable } from "../../../../test/helpers";
import { VariableDrawer, type DrawerState } from "./VariableDrawer";

afterEach(cleanup);

const tree: OrgTree = {
  groups: [{ id: 1, name: "acme", full_path: "acme", parent_id: null, web_url: "" }],
  projects: [
    { id: 10, name: "api", path_with_namespace: "acme/api", namespace_id: 1, web_url: "", archived: false },
  ],
};
const create: DrawerState = { mode: "create", target: { entity: "group", id: 1 }, targetPath: "acme" };

function open(state: DrawerState) {
  const onSubmit = vi.fn();
  render(<VariableDrawer state={state} tree={tree} busy={false} onClose={vi.fn()} onSubmit={onSubmit} />);
  return onSubmit;
}
const type = (label: RegExp, value: string) =>
  fireEvent.input(screen.getByLabelText(label), { target: { value } });
const submitButton = () => screen.getByRole("button", { name: /Add variable|Save changes/ });

describe("VariableDrawer", () => {
  it("rejects keys GitLab wouldn't accept", () => {
    open(create);
    type(/^Key$/, "BAD-KEY");
    expect(screen.getByRole("alert").textContent).toContain("letters, digits and underscores");
    expect(submitButton().hasAttribute("disabled")).toBe(true);
  });

  it("needs a value for a masked variable", () => {
    open(create);
    type(/^Key$/, "API_TOKEN");
    fireEvent.click(screen.getByRole("radio", { name: /^Masked(?! and hidden)/ }));
    expect(submitButton().hasAttribute("disabled")).toBe(true);
    type(/^Value$/, "a-long-secret-value");
    expect(submitButton().hasAttribute("disabled")).toBe(false);
  });

  it("submits a draft with the chosen settings", () => {
    const onSubmit = open(create);
    type(/^Key$/, "REGION");
    type(/^Value$/, "eu-west-1");
    type(/^Environments$/, "production");
    fireEvent.submit(screen.getByLabelText(/^Key$/).closest("form") as HTMLFormElement);
    expect(onSubmit).toHaveBeenCalledWith(
      { entity: "group", id: 1 },
      expect.objectContaining({
        key: "REGION",
        value: "eu-west-1",
        environment_scope: "production",
        masked: false,
      }),
    );
  });

  it("keeps a hidden variable's value unless a new one is typed", () => {
    open({
      mode: "edit",
      target: { entity: "group", id: 1 },
      targetPath: "acme",
      original: variable("SECRET", { hidden: true, masked: true, value: null }),
    });
    expect(screen.getByText(/can't be read back/)).toBeTruthy();
    expect(submitButton().hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole<HTMLInputElement>("radio", { name: /Masked and hidden/ }).disabled).toBe(true);
  });
});
