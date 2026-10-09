"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createBoDataGridUrlStateBuffer,
  parseBoDataGridUrlState,
  withBoDataGridFilter,
  withBoDataGridPatch,
  writeBoDataGridUrlState,
  type BoDataGridSortDirection,
  type BoDataGridUrlState,
  type BoDataGridUrlStateOptions,
} from "@/lib/bo-data-grid-state";

export function useBoDataGridUrlState(options: BoDataGridUrlStateOptions = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const optionKey = `${options.defaultPageSize ?? 25}:${(options.allowedPageSizes ?? []).join(",")}:${options.filterPrefix ?? "f_"}`;
  const urlState = useMemo(
    () => parseBoDataGridUrlState(searchParams, options),
    // optionKey is a stable primitive representation of the option contract.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchParams, optionKey],
  );
  const urlQuery = searchParams.toString();
  const bufferRef = useRef(createBoDataGridUrlStateBuffer(urlState));
  const [state, setState] = useState(urlState);

  useEffect(() => {
    if (!bufferRef.current.reconcile(urlState, urlQuery, pending)) return;
    setState(bufferRef.current.current());
  }, [pending, urlQuery, urlState]);

  const commit = useCallback((mutate: (current: BoDataGridUrlState) => BoDataGridUrlState) => {
    const next = mutate(bufferRef.current.current());
    const params = writeBoDataGridUrlState(searchParams, next, options);
    const query = params.toString();
    bufferRef.current.apply(next, query);
    setState(next);
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  }, [options, pathname, router, searchParams]);

  return {
    state,
    pending,
    setSearch(search: string) { commit((current) => withBoDataGridPatch(current, { search })); },
    setSort(sortKey: string | null, sortDirection: BoDataGridSortDirection = "asc") {
      commit((current) => withBoDataGridPatch(current, { sortKey, sortDirection }));
    },
    setPage(page: number) { commit((current) => withBoDataGridPatch(current, { page }, false)); },
    setPageSize(pageSize: number) { commit((current) => withBoDataGridPatch(current, { pageSize })); },
    setFilter(key: string, value: string | null) { commit((current) => withBoDataGridFilter(current, key, value)); },
    clearFilters() { commit((current) => withBoDataGridPatch(current, { filters: {} })); },
  };
}
