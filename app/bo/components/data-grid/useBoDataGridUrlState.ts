"use client";

import { useCallback, useMemo, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  parseBoDataGridUrlState,
  withBoDataGridFilter,
  withBoDataGridPatch,
  writeBoDataGridUrlState,
  type BoDataGridSortDirection,
  type BoDataGridUrlStateOptions,
} from "@/lib/bo-data-grid-state";

export function useBoDataGridUrlState(options: BoDataGridUrlStateOptions = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const optionKey = `${options.defaultPageSize ?? 25}:${(options.allowedPageSizes ?? []).join(",")}:${options.filterPrefix ?? "f_"}`;
  const state = useMemo(
    () => parseBoDataGridUrlState(searchParams, options),
    // optionKey is a stable primitive representation of the option contract.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchParams, optionKey],
  );

  const commit = useCallback((next: typeof state) => {
    const params = writeBoDataGridUrlState(searchParams, next, options);
    const query = params.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  }, [options, pathname, router, searchParams]);

  return {
    state,
    pending,
    setSearch(search: string) { commit(withBoDataGridPatch(state, { search })); },
    setSort(sortKey: string | null, sortDirection: BoDataGridSortDirection = "asc") {
      commit(withBoDataGridPatch(state, { sortKey, sortDirection }));
    },
    setPage(page: number) { commit(withBoDataGridPatch(state, { page }, false)); },
    setPageSize(pageSize: number) { commit(withBoDataGridPatch(state, { pageSize })); },
    setFilter(key: string, value: string | null) { commit(withBoDataGridFilter(state, key, value)); },
    clearFilters() { commit(withBoDataGridPatch(state, { filters: {} })); },
  };
}
