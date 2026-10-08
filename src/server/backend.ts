/* Where variables come from and where changes go: GitLab, or the built-in demo org. */

import type {
  EntityRef,
  GitLabUser,
  GitLabVariable,
  TokenAccess,
  VariableChanges,
  VariableDraft,
} from "../shared/types";
import { gitlabBaseUrl } from "./config";
import { tokenAccess, whoAmI } from "./gitlab/user";
import { createVariable, deleteVariable, updateVariable } from "./gitlab/variables";

export interface Backend {
  baseUrl(): string;
  whoAmI(token: string): Promise<GitLabUser>;
  tokenAccess(token: string): Promise<TokenAccess | null>;
  createVariable(token: string, target: EntityRef, draft: VariableDraft): Promise<GitLabVariable>;
  updateVariable(
    token: string,
    target: EntityRef,
    key: string,
    scope: string,
    changes: VariableChanges,
  ): Promise<GitLabVariable>;
  deleteVariable(token: string, target: EntityRef, key: string, scope: string): Promise<void>;
}

export const gitlabBackend: Backend = {
  baseUrl: gitlabBaseUrl,
  whoAmI,
  tokenAccess,
  createVariable,
  updateVariable,
  deleteVariable,
};
