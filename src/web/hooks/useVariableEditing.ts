/* The add, edit, delete and bulk-fix flows: which form or dialog is open, and submitting it. */

import { useCallback, useState } from "preact/hooks";
import { useToast } from "@/components/ui/Toast";
import type { DrawerState } from "@/components/variables/VariableDrawer";
import { changesFrom } from "@/edits";
import { FIX_WORDS, fixChanges, fixFor, planFix, type FixItem, type FixKind } from "@/fixes";
import { plural } from "@/format";
import type { Finding } from "@/insights";
import { rowId, type Row } from "@/rows";
import { findEntity } from "@/tree";
import type { EntityRef, OrgTree, VariableDraft } from "@shared/types";
import type { OrgVariablesApi } from "./useOrgVariables";

/** The bulk fix being reviewed: what it does, to which variables, and what failed last time. */
export interface FixState {
  kind: FixKind;
  findingTitle: string;
  items: FixItem[];
  /** GitLab's reason for each variable it refused, by row id */
  errors: ReadonlyMap<string, string>;
  /** bumped after a partly failed attempt, so the panel starts over with what's left */
  attempt: number;
}

export function useVariableEditing(org: OrgVariablesApi, tree: OrgTree | null, selection: EntityRef | null) {
  const toast = useToast();
  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  const [drawerBusy, setDrawerBusy] = useState(false);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [fixing, setFixing] = useState<FixState | null>(null);
  const [fixBusy, setFixBusy] = useState(false);

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

  /** Open the review panel for a finding's fix, over the variables behind it. */
  function openFix(f: Finding, rows: Row[]) {
    const kind = fixFor(f);
    if (!kind) return;
    setFixing({ kind, findingTitle: f.title, items: planFix(kind, rows), errors: new Map(), attempt: 0 });
  }

  const closeFix = useCallback(() => setFixing(null), []);

  /** Apply the fix to the chosen rows. Refused ones stay in the panel with GitLab's reason. */
  async function applyFix(rows: Row[]) {
    if (!fixing || rows.length === 0) return;
    const { kind } = fixing;
    const words = FIX_WORDS[kind];
    setFixBusy(true);
    try {
      const results = await org.updateMany(
        rows.map((r) => ({
          target: { entity: r.entity, id: r.entityId },
          original: r.v,
          changes: fixChanges(kind),
        })),
      );
      const errors = new Map<string, string>();
      rows.forEach((r, i) => {
        const result = results[i];
        if (!result?.ok) errors.set(rowId(r), result ? result.error : "No answer from the server");
      });
      const done = rows.length - errors.size;
      if (errors.size === 0) {
        toast("ok", `${words.done} ${plural(done, "variable")}`);
        setFixing(null);
        return;
      }
      toast(
        "err",
        `${words.done} ${done} of ${plural(rows.length, "variable")}. GitLab refused ${errors.size}.`,
      );
      const failed = rows.filter((r) => errors.has(rowId(r)));
      setFixing(
        (prev) => prev && { ...prev, items: planFix(kind, failed), errors, attempt: prev.attempt + 1 },
      );
    } catch (e) {
      toast("err", e instanceof Error ? e.message : "GitLab rejected the change");
    } finally {
      setFixBusy(false);
    }
  }

  return {
    fixing,
    fixBusy,
    openFix,
    closeFix,
    applyFix,
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
