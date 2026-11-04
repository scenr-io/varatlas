// @vitest-environment happy-dom
import { act, renderHook, waitFor } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BatchUpdateResult, OrgVariables } from "@shared/types";
import { authStatus, entity, variable } from "../../../test/helpers";
import { api } from "@/api";
import { useOrgVariables } from "./useOrgVariables";

vi.mock("@/api", () => ({
  api: {
    authStatus: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    loadAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    remove: vi.fn(),
  },
}));

const mocked = vi.mocked(api);

function snapshot(syncedAt = Date.now()): OrgVariables {
  return {
    tree: { groups: [], projects: [] },
    entities: [entity("group", 1, "acme", [variable("A"), variable("B")])],
    syncedAt,
    source: "graphql",
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});
afterEach(() => vi.restoreAllMocks());

describe("useOrgVariables", () => {
  it("reports an unreachable server instead of throwing", async () => {
    mocked.authStatus.mockRejectedValue(new TypeError("Failed to fetch"));
    const { result } = renderHook(() => useOrgVariables());
    await waitFor(() => expect(result.current.connectionError).toBe("Failed to fetch"));
    expect(result.current.auth).toBeNull();
  });

  it("loads the snapshot once the token works", async () => {
    mocked.authStatus.mockResolvedValue(authStatus());
    mocked.loadAll.mockResolvedValue(snapshot());
    const { result } = renderHook(() => useOrgVariables());
    await waitFor(() => expect(result.current.entities).toHaveLength(1));
    expect(mocked.loadAll).toHaveBeenCalledTimes(1);
  });

  it("refreshes a stale snapshot in the background", async () => {
    mocked.authStatus.mockResolvedValue(authStatus());
    mocked.loadAll.mockResolvedValueOnce(snapshot(Date.now() - 5 * 60_000)).mockResolvedValueOnce(snapshot());
    renderHook(() => useOrgVariables());
    await waitFor(() => expect(mocked.loadAll).toHaveBeenLastCalledWith(true));
  });

  it("keeps a load error for the UI", async () => {
    mocked.authStatus.mockResolvedValue(authStatus());
    mocked.loadAll.mockRejectedValue(new Error("GitLab is down"));
    const { result } = renderHook(() => useOrgVariables());
    await waitFor(() => expect(result.current.loadError).toBe("GitLab is down"));
  });

  it("applies deletes to the local snapshot", async () => {
    mocked.authStatus.mockResolvedValue(authStatus());
    mocked.loadAll.mockResolvedValue(snapshot());
    mocked.remove.mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useOrgVariables());
    await waitFor(() => expect(result.current.entities).toHaveLength(1));

    await act(() => result.current.deleteVariable({ entity: "group", id: 1 }, variable("A")));
    expect(result.current.entities?.[0]?.variables.map((v) => v.key)).toEqual(["B"]);
  });

  it("applies the saved part of a batch to the local snapshot", async () => {
    mocked.authStatus.mockResolvedValue(authStatus());
    mocked.loadAll.mockResolvedValue(snapshot());
    mocked.updateMany.mockResolvedValue({
      results: [
        { ok: true, variable: variable("A", { masked: true }) },
        { ok: false, error: "Refused" },
      ],
    });
    const { result } = renderHook(() => useOrgVariables());
    await waitFor(() => expect(result.current.entities).toHaveLength(1));

    const target = { entity: "group" as const, id: 1 };
    let results: BatchUpdateResult[] = [];
    await act(async () => {
      results = await result.current.updateMany([
        { target, original: variable("A"), changes: { masked: true } },
        { target, original: variable("B"), changes: { masked: true } },
      ]);
    });
    expect(results.map((r) => r.ok)).toEqual([true, false]);
    expect(mocked.updateMany).toHaveBeenCalledWith({
      updates: [
        { entity: "group", id: 1, key: "A", scope: "*", changes: { masked: true } },
        { entity: "group", id: 1, key: "B", scope: "*", changes: { masked: true } },
      ],
    });
    expect(result.current.entities?.[0]?.variables.map((v) => v.masked)).toEqual([true, false]);
  });
});
