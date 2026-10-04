/* Builds the nested group → subgroup → project tree shown in the sidebar. */

import type { OrgTree } from "./types";

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
    const node = nodes.get(g.id)!;
    const parent = g.parent_id !== null ? nodes.get(g.parent_id) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  for (const p of tree.projects) {
    nodes.get(p.namespace_id)?.projects.push({ id: p.id, name: p.name });
  }
  return roots;
}
