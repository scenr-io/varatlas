// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "@/api";
import { TokenGate } from "./TokenGate";

vi.mock("@/api", () => ({ api: { connect: vi.fn() } }));
const connect = vi.mocked(api.connect);

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

function submitToken(token: string) {
  fireEvent.input(screen.getByLabelText(/Personal access token/), { target: { value: token } });
  fireEvent.click(screen.getByRole("button", { name: "Connect to GitLab" }));
}

describe("TokenGate", () => {
  it("connects with the pasted token", async () => {
    connect.mockResolvedValue({ ok: true });
    const onConnected = vi.fn();
    render(<TokenGate baseUrl="https://gitlab.com" onConnected={onConnected} />);
    submitToken("glpat-abc");
    await waitFor(() => expect(onConnected).toHaveBeenCalled());
    expect(connect).toHaveBeenCalledWith("glpat-abc");
  });

  it("shows why GitLab refused it", async () => {
    connect.mockRejectedValue(new Error("This token can't read CI/CD variables."));
    render(<TokenGate baseUrl="https://gitlab.com" onConnected={vi.fn()} />);
    submitToken("glpat-narrow");
    expect((await screen.findByRole("alert")).textContent).toContain("can't read CI/CD variables");
  });

  it("can't be submitted empty", () => {
    render(<TokenGate baseUrl="https://gitlab.com" onConnected={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Connect to GitLab" }).hasAttribute("disabled")).toBe(true);
  });
});
