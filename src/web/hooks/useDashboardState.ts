/* What the user is looking at: the view, the selection, filters and open panels. */

import { useCallback, useEffect, useState } from "preact/hooks";
import type { Selection } from "@/components/layout/Sidebar";
import type { View } from "@/components/layout/TopBar";
import type { Mode } from "@/components/variables/FilterBar";
import type { Finding } from "@/insights";
import type { AttrFilter, LevelFilter } from "@/rows";

export function useDashboardState() {
  const [view, setView] = useState<View>(() => (location.hash === "#variables" ? "variables" : "overview"));
  const [mode, setMode] = useState<Mode>("location");
  const [selection, setSelection] = useState<Selection>(null);
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<LevelFilter>("all");
  const [attrs, setAttrs] = useState<ReadonlySet<AttrFilter>>(new Set());
  const [scope, setScope] = useState("all");
  const [finding, setFinding] = useState<Finding | null>(null);
  const [revealAll, setRevealAll] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);

  // Keep the view in the URL so a reload returns to it.
  useEffect(() => {
    history.replaceState(null, "", `#${view}`);
  }, [view]);

  const clearFilters = useCallback(() => {
    setQuery("");
    setAttrs(new Set());
    setScope("all");
    setLevel("all");
    setFinding(null);
  }, []);

  function toggleAttr(a: AttrFilter) {
    setAttrs((prev) => {
      const next = new Set(prev);
      if (next.has(a)) next.delete(a);
      else next.add(a);
      return next;
    });
  }

  /** Show the variables behind a finding. */
  function openFinding(f: Finding) {
    clearFilters();
    setFinding(f);
    setMode("location");
    setView("variables");
  }

  /** Show the variables in one environment scope. */
  function openScope(s: string) {
    clearFilters();
    setScope(s);
    setView("variables");
  }

  const filtersActive = !!(query || attrs.size || scope !== "all" || level !== "all" || finding);

  return {
    view,
    setView,
    mode,
    setMode,
    selection,
    setSelection,
    query,
    setQuery,
    level,
    setLevel,
    attrs,
    toggleAttr,
    scope,
    setScope,
    finding,
    setFinding,
    revealAll,
    toggleReveal: () => setRevealAll((s) => !s),
    mobileNav,
    setMobileNav,
    openKey,
    setOpenKey,
    clearFilters,
    openFinding,
    openScope,
    filtersActive,
  };
}

export type DashboardState = ReturnType<typeof useDashboardState>;
