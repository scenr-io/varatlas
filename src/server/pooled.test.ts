import { describe, expect, it } from "vitest";
import { pooled } from "./pooled";

describe("pooled", () => {
  it("preserves order and respects the concurrency limit", async () => {
    let inFlight = 0;
    let peak = 0;
    const out = await pooled([1, 2, 3, 4, 5], 2, async (n) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return n * 10;
    });
    expect(out).toEqual([10, 20, 30, 40, 50]);
    expect(peak).toBe(2);
  });
});
