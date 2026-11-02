"use client";

import { useEffect, useRef, useState } from "react";
import { fromSharedViewConfig, toSharedViewConfig } from "@/lib/bo-shared-view-grid-bridge";
import type { BoFilterField, BoFilterSettings } from "@/lib/bo-filter-settings-state";
import type { BoPublicViewRuntime } from "@/lib/bo-public-view-runtime";
import type { BoDataGridSortDirection, BoDataGridUrlState } from "@/lib/bo-data-grid-state";

type GridApi = {
  state: BoDataGridUrlState;
  setSearch: (value: string) => void;
  setSort: (key: string | null, direction?: BoDataGridSortDirection) => void;
  applyView: (value: Partial<BoDataGridUrlState>) => void;
};

export function useBoPilotSharedGridView({
  runtime, fields, sortableKeys, typed, setTyped, grid,
}: {
  runtime: BoPublicViewRuntime | null;
  fields: readonly BoFilterField[];
  sortableKeys: readonly string[];
  typed: BoFilterSettings;
  setTyped: (next: BoFilterSettings) => void;
  grid: GridApi;
}) {
  const [order, setOrder] = useState<readonly string[]>(fields.map((x) => x.key));
  const [error, setError] = useState<string | null>(null);
  const latest = useRef({ grid, typed, setTyped, fields, sortableKeys });
  useEffect(() => { latest.current = { grid, typed, setTyped, fields, sortableKeys }; });

  useEffect(() => {
    if (!runtime) return;
    let active = true;
    let lastId: string | null = null;
    let hydratedDefault = false;
    const onSnapshot = () => {
      if (!active) return;
      const snap = runtime.getSnapshot();
      if (snap.status !== "ready" || !snap.state) return;
      if (snap.error || snap.state.conflict) {
        setError(snap.error?.message ?? "View chung bị xung đột phiên bản. Hãy xử lý trước khi tiếp tục.");
        return;
      }
      const selectedId = snap.state.activeId;
      if (selectedId === lastId && hydratedDefault) { setError(null); return; }
      if (!selectedId && !hydratedDefault) {
        hydratedDefault = true;
        // Preserve URL-driven search/sort when the 'All' view first loads.
        try {
          const { grid: g, typed: t, fields: f } = latest.current;
          runtime.edit(toSharedViewConfig(snap.state.effective, t, g.state.search,
            g.state.sortKey, g.state.sortDirection, f.map((x) => x.key)));
        } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
        return;
      }
      lastId = selectedId;
      hydratedDefault = true;
      try {
        const { grid: g, setTyped: set, fields: f, sortableKeys: sortable } = latest.current;
        const config = fromSharedViewConfig(snap.state.effective, f, sortable);
        setError(null);
        set(config.typed);
        setOrder(config.order);
        g.applyView({ search: config.search, sortKey: config.sortKey,
          sortDirection: config.sortDirection, filters: {}, page: 1 });
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    };
    const unsubscribe = runtime.subscribe(onSnapshot);
    onSnapshot();
    return () => { active = false; unsubscribe(); };
  }, [runtime]);

  const update = (next: BoFilterSettings, search: string, sortKey: string | null, direction: BoDataGridSortDirection) => {
    if (!runtime) return;
    const snap = runtime.getSnapshot();
    if (snap.status !== "ready" || !snap.state) return;
    try {
      const view = fromSharedViewConfig(snap.state.effective, latest.current.fields, latest.current.sortableKeys);
      runtime.edit(toSharedViewConfig(snap.state.effective, next, search, sortKey, direction, view.order));
      setError(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  };

  return {
    columnOrder: order,
    viewError: error,
    onSearchChange: (search: string) => {
      grid.setSearch(search);
      update(typed, search, grid.state.sortKey, grid.state.sortDirection);
    },
    onSortChange: (key: string | null, direction: BoDataGridSortDirection = "asc") => {
      grid.setSort(key, direction);
      update(typed, grid.state.search, key, direction);
    },
    onTypedFilterSettingsChange: (next: BoFilterSettings) => {
      setTyped(next);
      update(next, grid.state.search, grid.state.sortKey, grid.state.sortDirection);
    },
  };
}
