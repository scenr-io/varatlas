/* Auth state, the org-wide variable snapshot, and mutations that keep it in sync. */

import { useCallback, useEffect, useState } from "preact/hooks";
import { api } from "@/api";
import type {
  AuthStatus,
  BatchUpdateResult,
  EntityRef,
  EntityVariables,
  GitLabVariable,
  OrgTree,
  OrgVariables,
  VariableChanges,
  VariableDraft,
} from "@shared/types";
import { isSameVariable, MAX_BATCH_UPDATES } from "@shared/variables";

/** One change in a batch: which variable, in which group or project, and what changes. */
export interface VariableUpdate {
  target: EntityRef;
  original: GitLabVariable;
  changes: VariableChanges;
}

const variableId = (entity: string, id: number, v: GitLabVariable) =>
  `${entity}:${id}:${v.key}:${v.environment_scope}`;

/** A cached snapshot older than this is refreshed in the background on open. */
const STALE_MS = 30_000;

export function useOrgVariables() {
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [tree, setTree] = useState<OrgTree | null>(null);
  const [entities, setEntities] = useState<EntityVariables[] | null>(null);
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** set when the browser can't reach the varatlas server at all */
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  /** Ask the server who we are. Never throws: a failed request becomes `connectionError`. */
  const checkAuth = useCallback(async () => {
    try {
      const status = await api.authStatus();
      setAuth(status);
      setConnectionError(null);
      return status.configured;
    } catch (e) {
      setConnectionError(e instanceof Error ? e.message : "The varatlas server didn't respond");
      return false;
    }
  }, []);

  const load = useCallback(async (refresh: boolean): Promise<OrgVariables | null> => {
    setRefreshing(true);
    try {
      const data = await api.loadAll(refresh);
      setTree(data.tree);
      setEntities(data.entities);
      setSyncedAt(data.syncedAt);
      setLoadError(null);
      return data;
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Load failed");
      return null;
    } finally {
      setRefreshing(false);
    }
  }, []);

  /** Show the cached snapshot immediately, then refresh it if it is stale. */
  const start = useCallback(async () => {
    if (!(await checkAuth())) return;
    const data = await load(false);
    if (data && Date.now() - data.syncedAt > STALE_MS) await load(true);
  }, [checkAuth, load]);

  const refresh = useCallback(() => load(true), [load]);

  useEffect(() => {
    void start();
  }, [start]);

  /** Apply `fn` to one entity's variable list in the local snapshot. */
  function patch(target: EntityRef, fn: (vars: GitLabVariable[]) => GitLabVariable[]) {
    setEntities(
      (prev) =>
        prev?.map((e) =>
          e.entity === target.entity && e.id === target.id ? { ...e, variables: fn(e.variables) } : e,
        ) ?? null,
    );
  }

  async function createVariable(target: EntityRef, draft: VariableDraft) {
    const { variable } = await api.create({ ...target, draft });
    patch(target, (vars) => [...vars, variable]);
  }

  async function updateVariable(target: EntityRef, original: GitLabVariable, changes: VariableChanges) {
    const { key, environment_scope: scope } = original;
    const { variable } = await api.update({ ...target, key, scope, changes });
    patch(target, (vars) => vars.map((v) => (isSameVariable(key, scope)(v) ? variable : v)));
  }

  /**
   * Apply several updates, in batches the server accepts. Each succeeds or fails on its own;
   * results come back in the same order. Saved changes reach the local snapshot even when a
   * later batch can't be sent.
   */
  async function updateMany(items: VariableUpdate[]): Promise<BatchUpdateResult[]> {
    const results: BatchUpdateResult[] = [];
    try {
      for (let i = 0; i < items.length; i += MAX_BATCH_UPDATES) {
        const chunk = items.slice(i, i + MAX_BATCH_UPDATES);
        const res = await api.updateMany({
          updates: chunk.map(({ target, original, changes }) => ({
            ...target,
            key: original.key,
            scope: original.environment_scope,
            changes,
          })),
        });
        results.push(...res.results);
      }
    } finally {
      const saved = new Map<string, GitLabVariable>();
      items.forEach((item, i) => {
        const r = results[i];
        if (r?.ok) saved.set(variableId(item.target.entity, item.target.id, item.original), r.variable);
      });
      if (saved.size > 0) {
        setEntities(
          (prev) =>
            prev?.map((e) => ({
              ...e,
              variables: e.variables.map((v) => saved.get(variableId(e.entity, e.id, v)) ?? v),
            })) ?? null,
        );
      }
    }
    return results;
  }

  async function deleteVariable(target: EntityRef, original: GitLabVariable) {
    const { key, environment_scope: scope } = original;
    await api.remove({ ...target, key, scope });
    patch(target, (vars) => vars.filter((v) => !isSameVariable(key, scope)(v)));
  }

  /** Forget the saved token. Never throws; a failed request shows up as `connectionError`. */
  async function disconnect() {
    try {
      await api.disconnect();
    } catch {
      /* checkAuth below reports the connection problem */
    }
    setAuth(null);
    setTree(null);
    setEntities(null);
    setSyncedAt(null);
    await checkAuth();
  }

  return {
    auth,
    tree,
    entities,
    syncedAt,
    loadError,
    connectionError,
    refreshing,
    start,
    refresh,
    createVariable,
    updateVariable,
    updateMany,
    deleteVariable,
    disconnect,
  };
}
export type OrgVariablesApi = ReturnType<typeof useOrgVariables>;
