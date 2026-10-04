/*
 * In-memory cache of the org snapshot, per token. Makes reopening the dashboard instant
 * and shares one in-flight load between concurrent requests. Memory only: secrets are
 * never written to disk, and a restart simply starts cold.
 */

import { createHash } from "node:crypto";
import type { EntityRef, GitLabVariable, OrgVariables } from "../shared/types";
import type { OrgData } from "./gitlab/org";

const MAX_TOKENS = 8;

export interface SnapshotStore {
  get(token: string, opts?: { fresh?: boolean }): Promise<OrgVariables>;
  patch(token: string, target: EntityRef, fn: (vars: GitLabVariable[]) => GitLabVariable[]): void;
  drop(token: string): void;
}

export function createSnapshotStore(
  load: (token: string) => Promise<OrgData>,
  now: () => number = Date.now,
): SnapshotStore {
  const cache = new Map<string, OrgVariables>();
  const inflight = new Map<string, Promise<OrgVariables>>();
  const keyOf = (token: string) => createHash("sha256").update(token).digest("hex");

  function remember(key: string, snap: OrgVariables) {
    cache.delete(key);
    cache.set(key, snap);
    while (cache.size > MAX_TOKENS) cache.delete(cache.keys().next().value!);
  }

  return {
    get(token, { fresh = false } = {}) {
      const key = keyOf(token);
      const cached = cache.get(key);
      if (cached && !fresh) return Promise.resolve(cached);

      let pending = inflight.get(key);
      if (!pending) {
        pending = load(token)
          .then((data) => {
            const snap: OrgVariables = { ...data, syncedAt: now() };
            remember(key, snap);
            return snap;
          })
          .finally(() => inflight.delete(key));
        inflight.set(key, pending);
      }
      return pending;
    },

    patch(token, target, fn) {
      const key = keyOf(token);
      const snap = cache.get(key);
      if (!snap) return;
      cache.set(key, {
        ...snap,
        entities: snap.entities.map((e) =>
          e.entity === target.entity && e.id === target.id ? { ...e, variables: fn(e.variables) } : e,
        ),
      });
    },

    drop(token) {
      cache.delete(keyOf(token));
    },
  };
}
