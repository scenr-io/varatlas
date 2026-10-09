import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse, stubFetch } from "../../../test/helpers";
import { GitLabError, glJson, glPaginated, retryDelayMs } from "./client";

/** Answer successive fetch calls with `responses`, in order. */
function mockFetch(...responses: Response[]) {
  const queue = [...responses];
  return stubFetch(() => queue.shift() ?? new Response(null, { status: 500 }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("glPaginated", () => {
  it("follows x-next-page until it is empty", async () => {
    const fetch = mockFetch(
      jsonResponse([1, 2], { headers: { "x-next-page": "2" } }),
      jsonResponse([3], { headers: { "x-next-page": "" } }),
    );
    expect(await glPaginated<number>("t", "/groups?x=1")).toEqual([1, 2, 3]);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0][0]).toBe("https://gitlab.com/api/v4/groups?x=1&per_page=100&page=1");
    expect(fetch.mock.calls[1][0]).toBe("https://gitlab.com/api/v4/groups?x=1&per_page=100&page=2");
  });

  it("sends the token server-side", async () => {
    const fetch = mockFetch(jsonResponse([]));
    await glPaginated("glpat-abc", "/groups");
    const headers = fetch.mock.calls[0]?.[1]?.headers as Record<string, string> | undefined;
    expect(headers?.["PRIVATE-TOKEN"]).toBe("glpat-abc");
  });

  it("surfaces GitLab's error message", async () => {
    mockFetch(jsonResponse({ message: "403 Forbidden" }, { status: 403 }));
    const err = await glPaginated("t", "/groups/1/variables").catch((e) => e);
    expect(err).toBeInstanceOf(GitLabError);
    expect(err.status).toBe(403);
    expect(err.message).toBe("403 Forbidden");
  });
});

describe("glJson", () => {
  it("retries rate-limited requests", async () => {
    const fetch = mockFetch(
      jsonResponse({}, { status: 429, headers: { "retry-after": "0" } }),
      jsonResponse({ username: "ada" }),
    );
    expect(await glJson("t", "/user")).toEqual({ username: "ada" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("stringifies structured validation errors", async () => {
    mockFetch(jsonResponse({ message: { value: ["is invalid"] } }, { status: 400 }));
    const err = (await glJson("t", "/projects/1/variables").catch((e) => e)) as GitLabError;
    expect(err.message).toBe('{"value":["is invalid"]}');
  });

  it("returns undefined for 204", async () => {
    mockFetch(new Response(null, { status: 204 }));
    expect(await glJson("t", "/x", { method: "DELETE" })).toBeUndefined();
  });
});

describe("retryDelayMs", () => {
  it("honours Retry-After, capped", () => {
    expect(retryDelayMs("2", 0)).toBe(2000);
    expect(retryDelayMs("600", 0)).toBe(30_000);
  });

  it("backs off exponentially without Retry-After", () => {
    expect(retryDelayMs(null, 0)).toBe(500);
    expect(retryDelayMs(null, 2)).toBe(2000);
  });
});
