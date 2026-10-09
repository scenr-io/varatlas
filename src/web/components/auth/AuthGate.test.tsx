// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { authStatus, fakeOrg } from "../../../../test/helpers";
import { AuthGate } from "./AuthGate";

afterEach(cleanup);

const app = () => <p>the app</p>;

describe("AuthGate", () => {
  it("explains an unreachable varatlas server and retries", () => {
    const org = fakeOrg({ connectionError: "Failed to fetch" });
    render(<AuthGate org={org}>{app}</AuthGate>);
    expect(screen.getByRole("heading", { name: "Can't reach varatlas" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Check again/ }));
    expect(org.start).toHaveBeenCalled();
  });

  it("shows a spinner while checking the token", () => {
    render(<AuthGate org={fakeOrg()}>{app}</AuthGate>);
    expect(screen.getByLabelText("Loading")).toBeTruthy();
  });

  it("renders the app once the token works", () => {
    render(<AuthGate org={fakeOrg({ auth: authStatus() })}>{app}</AuthGate>);
    expect(screen.getByText("the app")).toBeTruthy();
  });

  it("tells unreachable GitLab apart from a bad token", () => {
    const auth = authStatus({ configured: false, problem: "unreachable" });
    render(<AuthGate org={fakeOrg({ auth })}>{app}</AuthGate>);
    expect(screen.getByRole("heading", { name: "Can't reach GitLab at gitlab.com" })).toBeTruthy();
  });

  it("explains a refused server token, pointing at the failing check", () => {
    const auth = authStatus({ configured: false, problem: "invalid", source: "env" });
    render(<AuthGate org={fakeOrg({ auth })}>{app}</AuthGate>);
    expect(screen.getByRole("heading", { name: "GitLab refused the server's token" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Fails" }).closest("li")?.textContent).toContain(
      "GitLab accepts the token",
    );
  });

  it("offers another token when a pasted one lacks the scope", () => {
    const auth = authStatus({
      configured: false,
      problem: "scope",
      source: "cookie",
      token: { name: "t", scopes: ["read_user"], expiresAt: null },
    });
    const org = fakeOrg({ auth });
    render(<AuthGate org={org}>{app}</AuthGate>);
    expect(screen.getByText("read_user")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Use a different token" }));
    expect(org.disconnect).toHaveBeenCalled();
  });

  it("asks for a new token when a saved one was refused", () => {
    const auth = authStatus({ configured: false, problem: "invalid", source: "cookie" });
    render(<AuthGate org={fakeOrg({ auth })}>{app}</AuthGate>);
    expect(screen.getByRole("alert").textContent).toContain("GitLab refused your saved token");
    expect(screen.getByLabelText(/Personal access token/)).toBeTruthy();
  });
});
