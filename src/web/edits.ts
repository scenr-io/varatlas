/* Turning the add/edit form into what the API expects. */

import type { GitLabVariable, VariableChanges, VariableDraft } from "@shared/types";

/**
 * The changes to send when editing `original`. A hidden variable's value can't be read
 * back, so an empty value means "keep the current one" rather than "make it empty".
 */
export function changesFrom(original: GitLabVariable, draft: VariableDraft): VariableChanges {
  const changes: VariableChanges = {
    variable_type: draft.variable_type,
    protected: draft.protected,
    masked: draft.masked,
    raw: draft.raw,
    environment_scope: draft.environment_scope,
    description: draft.description ?? "",
  };
  if (!(original.hidden && draft.value === "")) changes.value = draft.value;
  return changes;
}
