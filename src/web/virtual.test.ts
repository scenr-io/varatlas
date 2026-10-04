import { describe, expect, it } from "vitest";
import { visibleRange } from "./virtual";

describe("visibleRange", () => {
  it("covers the viewport plus overscan", () => {
    expect(visibleRange(1000, 50, 0, 500, 5)).toEqual({ start: 0, end: 15 });
    expect(visibleRange(1000, 50, 5000, 500, 5)).toEqual({ start: 95, end: 115 });
  });

  it("clamps at the end of the list", () => {
    expect(visibleRange(20, 50, 900, 500, 5)).toEqual({ start: 13, end: 20 });
  });

  it("handles empty lists and negative scroll (overscroll bounce)", () => {
    expect(visibleRange(0, 50, 0, 500)).toEqual({ start: 0, end: 0 });
    expect(visibleRange(10, 50, -40, 500, 0)).toEqual({ start: 0, end: 10 });
  });
});
