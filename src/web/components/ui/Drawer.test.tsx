// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { useState } from "preact/hooks";
import { afterEach, describe, expect, it } from "vitest";
import { useAutoFocus } from "@/hooks/useAutoFocus";
import { Drawer } from "./Drawer";

afterEach(cleanup);

function Field() {
  const ref = useAutoFocus<HTMLInputElement>();
  return <input ref={ref} aria-label="Name" />;
}

function Harness({ withField = false }: { withField?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      {open && (
        <Drawer titleId="t" title="Details" onClose={() => setOpen(false)}>
          {withField ? <Field /> : <p>Body</p>}
        </Drawer>
      )}
    </>
  );
}

function openFrom() {
  const opener = screen.getByRole("button", { name: "Open" });
  opener.focus();
  fireEvent.click(opener);
  return opener;
}

describe("Drawer", () => {
  it("moves focus into the panel, and back to the opener on close", () => {
    render(<Harness />);
    const opener = openFrom();
    expect(document.activeElement).toBe(screen.getByRole("dialog", { name: "Details" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("leaves focus on a field that focused itself", () => {
    render(<Harness withField />);
    const opener = openFrom();
    expect(document.activeElement).toBe(screen.getByLabelText("Name"));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(document.activeElement).toBe(opener);
  });
});
