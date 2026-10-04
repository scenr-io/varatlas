/*
 * Fast path: load the whole org (groups, projects and every CI/CD variable) with a
 * handful of GraphQL queries per root group instead of one REST call per group/project.
 */

import type {
  EntityVariables,
  GitLabVariable,
  OrgTree,
  TreeGroup,
  TreeProject,
} from "../../shared/types";
import { excludedSegments } from "../config";
import { pooled } from "../pooled";
import { glGraphQL } from "./client";
import { isExcludedPath, type RawGroup } from "./discovery";
import { listVariables } from "./variables";

const NO_ACCESS = "No access to CI/CD variables (needs Maintainer)";
const PAGE = 100;

const VARS = `ciVariables(first: ${PAGE}) {
  nodes { key value variableType protected masked hidden raw environmentScope description }
  pageInfo { hasNextPage } }`;

const GROUPS_QUERY = `query($path: ID!, $after: String) { group(fullPath: $path) {
  id name fullPath webUrl parent { id } ${VARS}
  descendantGroups(first: ${PAGE}, after: $after) {
    pageInfo { hasNextPage endCursor }
    nodes { id name fullPath webUrl parent { id } ${VARS} } } } }`;

const PROJECTS_QUERY = `query($path: ID!, $after: String) { group(fullPath: $path) {
  projects(includeSubgroups: true, includeArchived: false, first: ${PAGE}, after: $after) {
    pageInfo { hasNextPage endCursor }
    nodes { id name fullPath webUrl archived group { id } ${VARS} } } } }`;

interface GqlVariable {
  key: string;
  value: string | null;
  variableType: "ENV_VAR" | "FILE";
  protected: boolean;
  masked: boolean;
  hidden: boolean | null;
  raw: boolean;
  environmentScope: string;
  description: string | null;
}

/** null when the token can't read the entity's variables. */
type GqlVariables = { nodes: GqlVariable[]; pageInfo: { hasNextPage: boolean } } | null;

interface GqlGroup {
  id: string;
  name: string;
  fullPath: string;
  webUrl: string;
  parent: { id: string } | null;
  ciVariables: GqlVariables;
}

interface GqlProject {
  id: string;
  name: string;
  fullPath: string;
  webUrl: string;
  archived: boolean;
  group: { id: string } | null;
  ciVariables: GqlVariables;
}

interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

/** "gid://gitlab/Group/123" → 123 */
export function gidToNumber(gid: string): number {
  return Number(gid.slice(gid.lastIndexOf("/") + 1));
}

export function toVariable(v: GqlVariable): GitLabVariable {
  return {
    key: v.key,
    value: v.value,
    variable_type: v.variableType === "FILE" ? "file" : "env_var",
    protected: v.protected,
    masked: v.masked,
    hidden: v.hidden ?? false,
    raw: v.raw,
    environment_scope: v.environmentScope,
    description: v.description,
  };
}

/** Fetch every page of a connection, one query per page. */
async function allPages<N>(
  fetchPage: (after: string | null) => Promise<{ nodes: N[]; pageInfo: PageInfo } | null>,
): Promise<N[]> {
  const out: N[] = [];
  for (let after: string | null = null; ; ) {
    const page = await fetchPage(after);
    if (!page) break;
    out.push(...page.nodes);
    if (!page.pageInfo.hasNextPage || !page.pageInfo.endCursor) break;
    after = page.pageInfo.endCursor;
  }
  return out;
}

type GroupsPage = {
  group: (GqlGroup & { descendantGroups: { nodes: GqlGroup[]; pageInfo: PageInfo } }) | null;
};
type ProjectsPage = {
  group: { projects: { nodes: GqlProject[]; pageInfo: PageInfo } } | null;
};

/** All groups (root included) and projects under one root, fetched concurrently. */
async function loadRoot(token: string, root: RawGroup) {
  let rootGroup: GqlGroup | null = null;
  const [descendants, projects] = await Promise.all([
    allPages(async (after) => {
      const d = await glGraphQL<GroupsPage>(token, GROUPS_QUERY, { path: root.full_path, after });
      if (d.group && after === null) rootGroup = d.group;
      return d.group?.descendantGroups ?? null;
    }),
    allPages(async (after) => {
      const d = await glGraphQL<ProjectsPage>(token, PROJECTS_QUERY, { path: root.full_path, after });
      return d.group?.projects ?? null;
    }),
  ]);
  const groups: GqlGroup[] = rootGroup ? [rootGroup, ...descendants] : descendants;
  return { groups, projects };
}

interface Loaded {
  entity: EntityVariables;
  /** more variables than fit in one GraphQL page */
  more: boolean;
}

function load(base: Omit<EntityVariables, "variables">, vars: GqlVariables): Loaded {
  if (vars === null) return { entity: { ...base, variables: [], error: NO_ACCESS }, more: false };
  return {
    entity: { ...base, variables: vars.nodes.map(toVariable) },
    more: vars.pageInfo.hasNextPage,
  };
}

export async function fetchOrgGraphQL(
  token: string,
  roots: RawGroup[],
): Promise<{ tree: OrgTree; entities: EntityVariables[] }> {
  const excluded = excludedSegments();
  const groupMap = new Map<number, GqlGroup>();
  const projectMap = new Map<number, GqlProject>();

  for (const { groups, projects } of await Promise.all(roots.map((r) => loadRoot(token, r)))) {
    for (const g of groups) groupMap.set(gidToNumber(g.id), g);
    for (const p of projects) projectMap.set(gidToNumber(p.id), p);
  }

  const groupEntries = [...groupMap.entries()]
    .filter(([, g]) => !isExcludedPath(g.fullPath, excluded))
    .sort(([, a], [, b]) => a.fullPath.localeCompare(b.fullPath));
  const projectEntries = [...projectMap.entries()]
    .filter(([, p]) => !p.archived && !isExcludedPath(p.fullPath, excluded))
    .sort(([, a], [, b]) => a.fullPath.localeCompare(b.fullPath));

  const groups: TreeGroup[] = groupEntries.map(([id, g]) => ({
    id,
    name: g.name,
    full_path: g.fullPath,
    parent_id: g.parent ? gidToNumber(g.parent.id) : null,
    web_url: g.webUrl,
  }));
  const projects: TreeProject[] = projectEntries.map(([id, p]) => ({
    id,
    name: p.name,
    path_with_namespace: p.fullPath,
    namespace_id: p.group ? gidToNumber(p.group.id) : 0,
    web_url: p.webUrl,
    archived: p.archived,
  }));

  const loaded = [
    ...groupEntries.map(([id, g]) =>
      load({ entity: "group", id, path: g.fullPath, name: g.name, web_url: g.webUrl }, g.ciVariables),
    ),
    ...projectEntries.map(([id, p]) =>
      load({ entity: "project", id, path: p.fullPath, name: p.name, web_url: p.webUrl }, p.ciVariables),
    ),
  ];

  // Rare: more than one page of variables on an entity. Fetch those fully over REST.
  await pooled(
    loaded.filter((l) => l.more),
    10,
    async (l) => {
      l.entity.variables = await listVariables(token, l.entity);
    },
  );

  return { tree: { groups, projects }, entities: loaded.map((l) => l.entity) };
}
