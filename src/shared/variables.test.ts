import { describe, expect, it } from "vitest";
import { maskProblem } from "./variables";

describe("maskProblem", () => {
  it("accepts values GitLab can mask", () => {
    expect(maskProblem("s3cr3t-value", false)).toBeNull();
    expect(maskProblem("a:b@c.d~e=f/g+h_i", false)).toBeNull();
  });

  it("refuses short values", () => {
    expect(maskProblem("short", false)).toMatch(/at least 8/);
  });

  it("refuses spaces and multiple lines", () => {
    expect(maskProblem("has a space", true)).toMatch(/spaces/);
    expect(maskProblem("line-one\nline-two", true)).toMatch(/one line/);
  });

  it("allows any symbol in raw values but only a few in expanded ones", () => {
    expect(maskProblem("p@ss#word!", true)).toBeNull();
    expect(maskProblem("p@ss#word!", false)).toMatch(/Expanded/);
  });
});
