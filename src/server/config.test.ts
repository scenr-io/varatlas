import { describe, expect, it } from "vitest";
import { allowedHosts, excludedSegments, gitlabBaseUrl, parseList } from "./config";

describe("config", () => {
  it("parses comma-separated lists", () => {
    expect(parseList(" Sandbox, ,archive ")).toEqual(["sandbox", "archive"]);
    expect(parseList(undefined)).toEqual([]);
  });

  it("defaults to gitlab.com and trims trailing slashes", () => {
    expect(gitlabBaseUrl({})).toBe("https://gitlab.com");
    expect(gitlabBaseUrl({ GITLAB_BASE_URL: "https://git.example.com//" })).toBe("https://git.example.com");
  });

  it("excludes nothing by default", () => {
    expect(excludedSegments({})).toEqual([]);
  });

  it("defaults allowed hosts to loopback", () => {
    expect(allowedHosts({})).toEqual(["localhost", "127.0.0.1", "::1"]);
    expect(allowedHosts({ VARATLAS_ALLOWED_HOSTS: "vars.internal" })).toEqual(["vars.internal"]);
  });
});
