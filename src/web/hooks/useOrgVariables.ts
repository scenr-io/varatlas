/* Auth state, the org-wide variable snapshot, and mutations that keep it in sync. */

import { useCallback, useEffect, useState } from "preact/hooks";
import { api } from "@/api";
import type {
  AuthStatus,
  EntityRef,
  EntityVariables,
  GitLabVariable,
  OrgTree,
  OrgVariables,
  VariableChanges,
  VariableDraft,
} from "@shared/types";

/** A cached snapshot older than this is refreshed in the background on open. */
const STALE_MS = 30_000;

const sameVar = (key: string, scope: string) => (v: GitLabVariable) =>
  v.key === key && v.environment_scope === scope;

export function useOrgVariables() {
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [tree, setTree] = useState<OrgTree | null>(null);
  const [entities, setEntities] = useState<EntityVariables[] | null>(null);
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const checkAuth = useCallback(async () => {
    const status = await api.authStatus();
    setAuth(status);
    return status.configured;
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
    start();
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
    patch(target, (vars) => vars.map((v) => (sameVar(key, scope)(v) ? variable : v)));
  }

  async function deleteVariable(target: EntityRef, original: GitLabVariable) {
    const { key, environment_scope: scope } = original;
    await api.remove({ ...target, key, scope });
    patch(target, (vars) => vars.filter((v) => !sameVar(key, scope)(v)));
  }

  async function disconnect() {
    await api.disconnect();
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
    refreshing,
    start,
    refresh,
    createVariable,
    updateVariable,
    deleteVariable,
    disconnect,
  };
}
