"use client";

/* Auth state, the org-wide variable snapshot, and mutations that keep it in sync. */

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type {
  AuthStatus,
  EntityRef,
  EntityVariables,
  GitLabVariable,
  OrgTree,
  VariableChanges,
  VariableDraft,
} from "@/lib/types";

const sameVar = (key: string, scope: string) => (v: GitLabVariable) =>
  v.key === key && v.environment_scope === scope;

export function useOrgVariables() {
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [tree, setTree] = useState<OrgTree | null>(null);
  const [entities, setEntities] = useState<EntityVariables[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const checkAuth = useCallback(async () => {
    const status = await api.authStatus();
    setAuth(status);
    return status.configured;
  }, []);

  const loadAll = useCallback(async () => {
    setRefreshing(true);
    setLoadError(null);
    try {
      const data = await api.loadAll();
      setTree(data.tree);
      setEntities(data.entities);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setRefreshing(false);
    }
  }, []);

  const connected = useCallback(async () => {
    if (await checkAuth()) await loadAll();
  }, [checkAuth, loadAll]);

  useEffect(() => {
    (async () => {
      if (await checkAuth()) await loadAll();
    })();
  }, [checkAuth, loadAll]);

  /** Apply `fn` to one entity's variable list in the local snapshot. */
  function patch(target: EntityRef, fn: (vars: GitLabVariable[]) => GitLabVariable[]) {
    setEntities(
      (prev) =>
        prev?.map((e) =>
          e.entity === target.entity && e.id === target.id
            ? { ...e, variables: fn(e.variables) }
            : e,
        ) ?? null,
    );
  }

  async function createVariable(target: EntityRef, draft: VariableDraft) {
    const { variable } = await api.create({ ...target, draft });
    patch(target, (vars) => [...vars, variable]);
  }

  async function updateVariable(
    target: EntityRef,
    original: GitLabVariable,
    changes: VariableChanges,
  ) {
    const { key, environment_scope: scope } = original;
    const { variable } = await api.update({ ...target, key, scope, changes });
    patch(target, (vars) =>
      vars.map((v) => (sameVar(key, scope)(v) ? variable : v)),
    );
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
    await checkAuth();
  }

  return {
    auth,
    tree,
    entities,
    loadError,
    refreshing,
    loadAll,
    connected,
    createVariable,
    updateVariable,
    deleteVariable,
    disconnect,
  };
}
