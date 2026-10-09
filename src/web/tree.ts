/* Builds the nested group → subgroup → project tree shown in the sidebar. */

import type { EntityRef, OrgTree } from "@shared/types";

export interface GroupNode {
  id: number;
  name: string;
  full_path: string;
  children: GroupNode[];
  projects: { id: number; name: string }[];
}

/** Root nodes of the visible hierarchy. Groups whose parent is not visible become roots. */
export function buildGroupTree(tree: OrgTree): GroupNode[] {
  const nodes = new Map<number, GroupNode>();
  for (const g of tree.groups) {
    nodes.set(g.id, {
      id: g.id,
      name: g.name,
      full_path: g.full_path,
      children: [],
      projects: [],
    });
  }

  const roots: GroupNode[] = [];
  for (const g of tree.groups) {
    const node = nodes.get(g.id);
    if (!node) continue;
    const parent = g.parent_id !== null ? nodes.get(g.parent_id) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  for (const p of tree.projects) {
    nodes.get(p.namespace_id)?.projects.push({ id: p.id, name: p.name });
  }
  return roots;
}

/** A selected group or project, with its path and display name. */
export interface Selected extends EntityRef {
  path: string;
  name: string;
}

export function findEntity(tree: OrgTree, ref: EntityRef): Selected | null {
  if (ref.entity === "group") {
    const g = tree.groups.find((x) => x.id === ref.id);
    return g ? { ...ref, path: g.full_path, name: g.name } : null;
  }
  const p = tree.projects.find((x) => x.id === ref.id);
  return p ? { ...ref, path: p.path_with_namespace, name: p.name } : null;
}
