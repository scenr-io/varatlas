/* The add, edit and delete flows: which form or dialog is open, and submitting it. */

import { useCallback, useState } from "preact/hooks";
import { useToast } from "@/components/ui/Toast";
import type { DrawerState } from "@/components/variables/VariableDrawer";
import { changesFrom } from "@/edits";
import type { Row } from "@/rows";
import { findEntity } from "@/tree";
import type { EntityRef, OrgTree, VariableDraft } from "@shared/types";
import type { OrgVariablesApi } from "./useOrgVariables";

export function useVariableEditing(org: OrgVariablesApi, tree: OrgTree | null, selection: EntityRef | null) {
  const toast = useToast();
  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  const [drawerBusy, setDrawerBusy] = useState(false);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  /** Open the add form, on the current selection or else the first group or project. */
  function openCreate(key?: string) {
    if (!tree) return;
    const group = tree.groups[0];
    const project = tree.projects[0];
    const fallback: EntityRef | null = group
      ? { entity: "group", id: group.id }
      : project
        ? { entity: "project", id: project.id }
        : null;
    const target = selection ?? fallback;
    if (!target) return;
    setDrawer({ mode: "create", target, targetPath: findEntity(tree, target)?.path ?? "", key });
  }

  function openEdit(r: Row) {
    setDrawer({
      mode: "edit",
      target: { entity: r.entity, id: r.entityId },
      targetPath: r.path,
      original: r.v,
    });
  }

  async function submit(target: EntityRef, draft: VariableDraft) {
    if (!drawer) return;
    setDrawerBusy(true);
    try {
      if (drawer.mode === "create") {
        await org.createVariable(target, draft);
        toast("ok", `Added ${draft.key} to ${(tree && findEntity(tree, target)?.path) ?? "GitLab"}`);
      } else if (drawer.original) {
        const { original } = drawer;
        await org.updateVariable(drawer.target, original, changesFrom(original, draft));
        toast("ok", `Saved ${original.key} in ${drawer.targetPath}`);
      }
      setDrawer(null);
    } catch (e) {
      toast("err", e instanceof Error ? e.message : "GitLab rejected the change");
    } finally {
      setDrawerBusy(false);
    }
  }

  const closeDrawer = useCallback(() => setDrawer(null), []);
  const cancelDelete = useCallback(() => setDeleting(null), []);

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await org.deleteVariable({ entity: deleting.entity, id: deleting.entityId }, deleting.v);
      toast("ok", `Deleted ${deleting.v.key} from ${deleting.path}`);
      setDeleting(null);
    } catch (e) {
      toast("err", e instanceof Error ? e.message : "GitLab rejected the deletion");
    } finally {
      setDeleteBusy(false);
    }
  }

  return {
    drawer,
    drawerBusy,
    openCreate,
    openEdit,
    closeDrawer,
    submit,
    deleting,
    deleteBusy,
    askDelete: setDeleting,
    cancelDelete,
    confirmDelete,
  };
}
