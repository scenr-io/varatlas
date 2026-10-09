/* The app once a usable token is connected: sidebar, top bar, the two views and the panels. */

import { Plus } from "lucide-preact";
import { accessState } from "@/access";
import { AccessBanner } from "@/components/access/AccessBanner";
import { NoGroups, RoleMissing } from "@/components/access/screens";
import { Sidebar, type Selection } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { Overview } from "@/components/overview/Overview";
import { Button } from "@/components/ui/Button";
import { DeleteDialog } from "@/components/variables/DeleteDialog";
import { FilterBar } from "@/components/variables/FilterBar";
import { KeyDetail } from "@/components/variables/KeyDetail";
import { KeyTable } from "@/components/variables/KeyTable";
import { VariableDrawer } from "@/components/variables/VariableDrawer";
import { VariableTable } from "@/components/variables/VariableTable";
import { plural } from "@/format";
import { useDashboardState } from "@/hooks/useDashboardState";
import type { OrgVariablesApi } from "@/hooks/useOrgVariables";
import { useOrgView } from "@/hooks/useOrgView";
import { useVariableEditing } from "@/hooks/useVariableEditing";
import { distinctScopes } from "@/rows";
import type { AuthStatus } from "@shared/types";

export function Workspace({ org, auth }: { org: OrgVariablesApi; auth: AuthStatus }) {
  const { tree, entities } = org;
  const ui = useDashboardState();
  const view = useOrgView(tree, entities, ui);
  const edit = useVariableEditing(org, tree, ui.selection);

  const access = accessState(auth, entities);
  const readOnly = access.kind === "ok" && access.readOnly;
  const refresh = () => void org.refresh();
  const useOther = () => void org.disconnect();
  const retry = () => void org.start();

  const loading = entities === null && !org.loadError;
  const blockingError = entities === null ? org.loadError : null;
  const keySummary = ui.openKey ? view.allKeys.find((k) => k.key === ui.openKey) : undefined;

  const blocked =
    access.kind === "no-role" ? (
      <RoleMissing auth={auth} paths={access.paths} onRetry={refresh} onUseOther={useOther} />
    ) : access.kind === "no-groups" ? (
      <NoGroups auth={auth} onRetry={refresh} onUseOther={useOther} />
    ) : null;

  const empty = ui.filtersActive ? (
    <>
      <p className="font-medium text-fg">No variables match these filters</p>
      <Button className="mt-4" onClick={ui.clearFilters}>
        Clear filters
      </Button>
    </>
  ) : (
    <>
      <p className="font-medium text-fg">No variables here yet</p>
      <p className="mt-1 text-sm text-fg-2">Variables you add to this group or project show up here.</p>
      {!readOnly && (
        <Button variant="primary" className="mt-4" onClick={() => edit.openCreate()}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add variable
        </Button>
      )}
    </>
  );

  const sidebar = (onPick: (s: Selection) => void) => (
    <Sidebar
      tree={tree}
      varCounts={view.varCounts}
      selection={ui.selection}
      onSelect={onPick}
      onRefresh={refresh}
      refreshing={org.refreshing}
      user={auth.user ?? null}
      canLogout={auth.source === "cookie"}
      onLogout={useOther}
    />
  );

  const table = (
    <VariableTable
      rows={view.filtered}
      loading={loading}
      loadError={blockingError}
      onRetry={retry}
      keyLocations={view.keyLocations}
      revealAll={ui.revealAll}
      onOpenKey={ui.setOpenKey}
      onEdit={edit.openEdit}
      onDelete={edit.askDelete}
      empty={empty}
      readOnly={readOnly}
    />
  );

  return (
    <div className="flex h-screen overflow-hidden bg-page">
      <aside className="hidden w-72 flex-shrink-0 md:flex md:flex-col">{sidebar(ui.setSelection)}</aside>

      {ui.mobileNav && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => ui.setMobileNav(false)} />
          <aside className="absolute bottom-0 left-0 top-0 w-72">
            {sidebar((s) => {
              ui.setSelection(s);
              ui.setMobileNav(false);
            })}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar
          view={ui.view}
          onView={ui.setView}
          scopeName={view.selected ? view.selected.name : "Whole org"}
          scopePath={view.selected?.path ?? null}
          syncedAt={org.syncedAt}
          refreshing={org.refreshing}
          refreshError={entities ? org.loadError : null}
          canAdd={!!tree && !blocked}
          readOnly={readOnly}
          onAdd={() => edit.openCreate()}
          onMenu={() => ui.setMobileNav(true)}
        />

        {access.kind === "ok" && (
          <AccessBanner
            readOnly={access.readOnly}
            expiresInDays={access.expiresInDays}
            baseUrl={auth.baseUrl}
            demo={auth.demo}
          />
        )}

        {blocked ? (
          <main className="flex-1 overflow-y-auto px-4 py-10 md:px-8">{blocked}</main>
        ) : ui.view === "overview" ? (
          <main className="flex-1 overflow-y-auto">
            {view.overview ? (
              <Overview
                {...view.overview}
                findings={view.findings}
                onFinding={ui.openFinding}
                onGroup={(id) => ui.setSelection({ entity: "group", id })}
                onScope={ui.openScope}
                onKey={ui.setOpenKey}
              />
            ) : (
              table
            )}
          </main>
        ) : (
          <main className="flex min-h-0 flex-1 flex-col gap-4 px-4 pt-5 md:px-8">
            <FilterBar
              mode={ui.mode}
              onMode={ui.setMode}
              query={ui.query}
              onQuery={ui.setQuery}
              showLevel={view.selected?.entity !== "project"}
              level={ui.level}
              onLevel={ui.setLevel}
              attrs={ui.attrs}
              onToggleAttr={ui.toggleAttr}
              scope={ui.scope}
              scopes={distinctScopes(view.scoped)}
              onScope={ui.setScope}
              revealAll={ui.revealAll}
              onToggleReveal={ui.toggleReveal}
              finding={ui.finding?.title ?? null}
              onClearFinding={() => ui.setFinding(null)}
            />
            {entities && (
              <p className="-mb-1 text-xs text-fg-3">
                {ui.mode === "location"
                  ? `Showing ${view.filtered.length} of ${plural(view.scoped.length, "variable")}`
                  : `Showing ${plural(view.keysInView.length, "key")}`}
                {view.selected?.entity === "project" && ", including what this project inherits"}
              </p>
            )}
            {ui.mode === "location" || loading || blockingError ? (
              table
            ) : (
              <KeyTable keys={view.keysInView} onOpen={ui.setOpenKey} empty={empty} />
            )}
          </main>
        )}
      </div>

      {keySummary && tree && (
        <KeyDetail
          summary={keySummary}
          tree={tree}
          onClose={() => ui.setOpenKey(null)}
          onEdit={edit.openEdit}
          onDelete={edit.askDelete}
          onAdd={edit.openCreate}
          readOnly={readOnly}
        />
      )}

      {edit.drawer && tree && (
        <VariableDrawer
          state={edit.drawer}
          tree={tree}
          busy={edit.drawerBusy}
          onClose={edit.closeDrawer}
          onSubmit={(target, draft) => void edit.submit(target, draft)}
        />
      )}

      {edit.deleting && (
        <DeleteDialog
          row={edit.deleting}
          busy={edit.deleteBusy}
          onCancel={edit.cancelDelete}
          onConfirm={() => void edit.confirmDelete()}
        />
      )}
    </div>
  );
}
