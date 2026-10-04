/* CI/CD variable CRUD for groups and projects. */

import { pooled } from "../pooled";
import type {
  EntityRef,
  EntityType,
  EntityVariables,
  GitLabVariable,
  OrgTree,
  VariableChanges,
  VariableDraft,
} from "../../shared/types";
import { glJson, glPaginated, GitLabError } from "./client";

const CONCURRENCY = 10;

function entityBase({ entity, id }: EntityRef): string {
  return entity === "group" ? `/groups/${id}` : `/projects/${id}`;
}

/** Path to one variable. The scope filter disambiguates same-key variables. */
function variablePath(target: EntityRef, key: string, scope: string): string {
  return (
    `${entityBase(target)}/variables/${encodeURIComponent(key)}` +
    `?filter[environment_scope]=${encodeURIComponent(scope)}`
  );
}

export function listVariables(
  token: string,
  target: EntityRef,
): Promise<GitLabVariable[]> {
  return glPaginated<GitLabVariable>(token, `${entityBase(target)}/variables`);
}

export function fetchAllVariables(
  token: string,
  tree: OrgTree,
): Promise<EntityVariables[]> {
  const targets: Omit<EntityVariables, "variables">[] = [
    ...tree.groups.map((g) => ({
      entity: "group" as EntityType,
      id: g.id,
      path: g.full_path,
      name: g.name,
      web_url: g.web_url,
    })),
    ...tree.projects.map((p) => ({
      entity: "project" as EntityType,
      id: p.id,
      path: p.path_with_namespace,
      name: p.name,
      web_url: p.web_url,
    })),
  ];

  return pooled(targets, CONCURRENCY, async (t) => {
    try {
      return { ...t, variables: await listVariables(token, t) };
    } catch (e) {
      const error =
        e instanceof GitLabError
          ? e.status === 403
            ? "No access to CI/CD variables (needs Maintainer)"
            : e.message
          : "Failed to fetch";
      return { ...t, variables: [], error };
    }
  });
}

export function createVariable(
  token: string,
  target: EntityRef,
  draft: VariableDraft,
): Promise<GitLabVariable> {
  const body: Record<string, unknown> = {
    key: draft.key,
    value: draft.value,
    variable_type: draft.variable_type,
    protected: draft.protected,
    masked: draft.masked || draft.masked_and_hidden === true,
    raw: draft.raw,
    environment_scope: draft.environment_scope,
    description: draft.description || undefined,
  };
  if (draft.masked_and_hidden) body.masked_and_hidden = true;
  return glJson<GitLabVariable>(token, `${entityBase(target)}/variables`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateVariable(
  token: string,
  target: EntityRef,
  key: string,
  originalScope: string,
  changes: VariableChanges,
): Promise<GitLabVariable> {
  return glJson<GitLabVariable>(token, variablePath(target, key, originalScope), {
    method: "PUT",
    body: JSON.stringify(changes),
  });
}

export async function deleteVariable(
  token: string,
  target: EntityRef,
  key: string,
  scope: string,
): Promise<void> {
  await glJson<void>(token, variablePath(target, key, scope), {
    method: "DELETE",
  });
}
