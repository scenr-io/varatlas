/* Types shared by the server and the browser. */

export type EntityType = "group" | "project";

/** Identifies a group or project. */
export interface EntityRef {
  entity: EntityType;
  id: number;
}

export type VariableType = "env_var" | "file";

export interface GitLabVariable {
  key: string;
  /** null for masked & hidden variables — GitLab never returns the value */
  value: string | null;
  variable_type: VariableType;
  protected: boolean;
  masked: boolean;
  /** true when the variable was created as "masked & hidden" */
  hidden?: boolean;
  /** true = do NOT expand variable references ($VAR stays literal) */
  raw: boolean;
  environment_scope: string;
  description: string | null;
}

/** Fields for creating a variable. */
export interface VariableDraft {
  key: string;
  value: string;
  variable_type: VariableType;
  protected: boolean;
  masked: boolean;
  /** Create-only: GitLab cannot toggle this after creation. */
  masked_and_hidden?: boolean;
  raw: boolean;
  environment_scope: string;
  description?: string;
}

/** Fields that can change on an existing variable. The key cannot. */
export type VariableChanges = Partial<
  Omit<VariableDraft, "key" | "masked_and_hidden">
>;

export interface TreeGroup {
  id: number;
  name: string;
  full_path: string;
  parent_id: number | null;
  web_url: string;
}

export interface TreeProject {
  id: number;
  name: string;
  path_with_namespace: string;
  namespace_id: number;
  web_url: string;
  archived: boolean;
}

export interface OrgTree {
  groups: TreeGroup[];
  projects: TreeProject[];
}

export interface EntityVariables extends EntityRef {
  path: string;
  name: string;
  web_url: string;
  variables: GitLabVariable[];
  error?: string;
}

export interface GitLabUser {
  username: string;
  name: string;
  avatar_url: string | null;
}

export type TokenSource = "env" | "cookie";

export interface AuthStatus {
  configured: boolean;
  source: TokenSource | null;
  user?: GitLabUser;
  baseUrl: string;
}

/* API payloads ------------------------------------------------------ */

export interface CreateVariableRequest extends EntityRef {
  draft: VariableDraft;
}

export interface UpdateVariableRequest extends EntityRef {
  key: string;
  /** environment scope of the existing variable */
  scope: string;
  changes: VariableChanges;
}

export interface DeleteVariableRequest extends EntityRef {
  key: string;
  scope: string;
}

export interface OrgVariables {
  tree: OrgTree;
  entities: EntityVariables[];
}
