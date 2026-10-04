/*
 * REST discovery — every group, subgroup and project the token can see.
 * The GraphQL loader (graphql.ts) is the fast path; this is its fallback.
 */

import type { OrgTree, TreeGroup, TreeProject } from "../../shared/types";
import { excludedSegments } from "../config";
import { pooled } from "../pooled";
import { glPaginated } from "./client";

const CONCURRENCY = 6;

export interface RawGroup {
  id: number;
  name: string;
  full_path: string;
  parent_id: number | null;
  web_url: string;
}

interface RawProject {
  id: number;
  name: string;
  path_with_namespace: string;
  archived: boolean;
  web_url: string;
  namespace: { id: number; kind: string };
}

/** True if any segment of `fullPath` is excluded. */
export function isExcludedPath(fullPath: string, excluded: string[]): boolean {
  if (excluded.length === 0) return false;
  return fullPath
    .toLowerCase()
    .split("/")
    .some((seg) => excluded.includes(seg));
}

/** Every group the token is a member of (subgroups included). */
export function listMemberGroups(token: string): Promise<RawGroup[]> {
  return glPaginated<RawGroup>(token, "/groups?min_access_level=20&order_by=path&sort=asc");
}

/** Roots are groups whose parent isn't visible to the token. */
export function rootGroups(groups: RawGroup[]): RawGroup[] {
  const ids = new Set(groups.map((g) => g.id));
  return groups.filter((g) => g.parent_id === null || !ids.has(g.parent_id));
}

export async function discoverTree(token: string, memberGroups: RawGroup[]): Promise<OrgTree> {
  const excluded = excludedSegments();
  const groupMap = new Map<number, RawGroup>();
  for (const g of memberGroups) groupMap.set(g.id, g);
  const roots = rootGroups(memberGroups);

  // Walk descendants of each root so deep subgroups the token inherits access to are never missed.
  await pooled(roots, CONCURRENCY, async (root) => {
    try {
      const descendants = await glPaginated<RawGroup>(token, `/groups/${root.id}/descendant_groups`);
      for (const g of descendants) groupMap.set(g.id, g);
    } catch {
      /* no access to the descendants listing — member groups still shown */
    }
  });

  const projectMap = new Map<number, RawProject>();
  await pooled(roots, CONCURRENCY, async (root) => {
    try {
      const projects = await glPaginated<RawProject>(
        token,
        `/groups/${root.id}/projects?include_subgroups=true&archived=false`,
      );
      for (const p of projects) projectMap.set(p.id, p);
    } catch {
      /* skip roots we cannot list */
    }
  });

  const groups: TreeGroup[] = [...groupMap.values()]
    .filter((g) => !isExcludedPath(g.full_path, excluded))
    .map((g) => ({
      id: g.id,
      name: g.name,
      full_path: g.full_path,
      parent_id: g.parent_id,
      web_url: g.web_url,
    }))
    .sort((a, b) => a.full_path.localeCompare(b.full_path));

  const projects: TreeProject[] = [...projectMap.values()]
    .filter((p) => !isExcludedPath(p.path_with_namespace, excluded))
    .map((p) => ({
      id: p.id,
      name: p.name,
      path_with_namespace: p.path_with_namespace,
      namespace_id: p.namespace.id,
      web_url: p.web_url,
      archived: p.archived,
    }))
    .sort((a, b) => a.path_with_namespace.localeCompare(b.path_with_namespace));

  return { groups, projects };
}
