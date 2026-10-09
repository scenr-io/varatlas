/* Load the whole org: GraphQL fast path, REST fallback (e.g. older self-managed GitLab). */

import type { EntityVariables, OrgTree, SnapshotSource } from "../../shared/types";
import { GitLabError } from "./client";
import { discoverTree, listMemberGroups, rootGroups } from "./discovery";
import { fetchOrgGraphQL } from "./graphql";
import { fetchAllVariables } from "./variables";

export interface OrgData {
  tree: OrgTree;
  entities: EntityVariables[];
  source: SnapshotSource;
}

export async function fetchOrg(token: string): Promise<OrgData> {
  const memberGroups = await listMemberGroups(token);
  try {
    const data = await fetchOrgGraphQL(token, rootGroups(memberGroups));
    return { ...data, source: "graphql" };
  } catch (e) {
    // A bad or under-scoped token fails the same way over REST, so don't retry it.
    if (e instanceof GitLabError && (e.status === 401 || e.status === 403)) throw e;
    console.warn(
      `[varatlas] GraphQL load failed, falling back to REST: ${e instanceof Error ? e.message : String(e)}`,
    );
    const tree = await discoverTree(token, memberGroups);
    return { tree, entities: await fetchAllVariables(token, tree), source: "rest" };
  }
}
