export type BoDataGridSortDirection = "asc" | "desc";

export type BoDataGridUrlState = {
  search: string;
  sortKey: string | null;
  sortDirection: BoDataGridSortDirection;
  page: number;
  pageSize: number;
  filters: Record<string, string>;
};

export type BoDataGridUrlStateOptions = {
  defaultPageSize?: number;
  allowedPageSizes?: readonly number[];
  filterPrefix?: string;
};

const DEFAULT_PAGE_SIZES = [10, 25, 50, 100] as const;
const DEFAULT_FILTER_PREFIX = "f_";

export function parseBoDataGridUrlState(
  input: URLSearchParams | string,
  options: BoDataGridUrlStateOptions = {},
): BoDataGridUrlState {
  const params = typeof input === "string" ? new URLSearchParams(input.startsWith("?") ? input.slice(1) : input) : input;
  const allowedPageSizes = normalizePageSizes(options.allowedPageSizes);
  const defaultPageSize = choosePageSize(options.defaultPageSize ?? 25, allowedPageSizes, allowedPageSizes[0] ?? 25);
  const pageSize = choosePageSize(readPositiveInt(params.get("size")), allowedPageSizes, defaultPageSize);
  const prefix = options.filterPrefix ?? DEFAULT_FILTER_PREFIX;
  const filters: Record<string, string> = {};

  params.forEach((value, key) => {
    if (!key.startsWith(prefix) || value.trim() === "") return;
    const filterKey = key.slice(prefix.length).trim();
    if (filterKey) filters[filterKey] = value;
  });

  return {
    search: params.get("q")?.trim() ?? "",
    sortKey: params.get("sort")?.trim() || null,
    sortDirection: params.get("dir") === "desc" ? "desc" : "asc",
    page: Math.max(1, readPositiveInt(params.get("page")) ?? 1),
    pageSize,
    filters,
  };
}

export function writeBoDataGridUrlState(
  current: URLSearchParams | string,
  state: BoDataGridUrlState,
  options: BoDataGridUrlStateOptions = {},
): URLSearchParams {
  const params = typeof current === "string" ? new URLSearchParams(current.startsWith("?") ? current.slice(1) : current) : new URLSearchParams(current);
  const prefix = options.filterPrefix ?? DEFAULT_FILTER_PREFIX;

  for (const key of [...params.keys()]) if (key.startsWith(prefix)) params.delete(key);
  setOrDelete(params, "q", state.search.trim());
  setOrDelete(params, "sort", state.sortKey ?? "");
  setOrDelete(params, "dir", state.sortKey ? state.sortDirection : "");
  setOrDelete(params, "page", state.page > 1 ? String(state.page) : "");

  const defaultPageSize = options.defaultPageSize ?? 25;
  setOrDelete(params, "size", state.pageSize !== defaultPageSize ? String(state.pageSize) : "");
  for (const [key, value] of Object.entries(state.filters).sort(([left], [right]) => left.localeCompare(right))) {
    if (value.trim()) params.set(`${prefix}${key}`, value);
  }
  return params;
}

export function withBoDataGridPatch(
  state: BoDataGridUrlState,
  patch: Partial<Omit<BoDataGridUrlState, "filters">> & { filters?: Record<string, string> },
  resetPage = true,
): BoDataGridUrlState {
  const next = { ...state, ...patch, filters: patch.filters ?? state.filters };
  return resetPage && patch.page === undefined ? { ...next, page: 1 } : next;
}

export function withBoDataGridFilter(
  state: BoDataGridUrlState,
  key: string,
  value: string | null,
): BoDataGridUrlState {
  const filters = { ...state.filters };
  if (!value?.trim()) delete filters[key];
  else filters[key] = value;
  return { ...state, filters, page: 1 };
}

export function boDataGridRange(page: number, pageSize: number, total: number) {
  const safeTotal = Math.max(0, total);
  if (!safeTotal) return { from: 0, to: 0, total: 0, pageCount: 0, page: 1 };
  const pageCount = Math.max(1, Math.ceil(safeTotal / Math.max(1, pageSize)));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const from = (safePage - 1) * pageSize + 1;
  return { from, to: Math.min(safeTotal, from + pageSize - 1), total: safeTotal, pageCount, page: safePage };
}

function setOrDelete(params: URLSearchParams, key: string, value: string) {
  if (value) params.set(key, value);
  else params.delete(key);
}

function readPositiveInt(value: string | null) {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizePageSizes(values: readonly number[] | undefined) {
  const normalized = [...new Set((values?.length ? values : DEFAULT_PAGE_SIZES).filter((value) => Number.isSafeInteger(value) && value > 0))].sort((a, b) => a - b);
  return normalized.length ? normalized : [...DEFAULT_PAGE_SIZES];
}

function choosePageSize(value: number | null, allowed: readonly number[], fallback: number) {
  return value && allowed.includes(value) ? value : fallback;
}

export type BoDataGridUrlStateBuffer = {
  current(): BoDataGridUrlState;
  requestedQuery(): string | null;
  apply(next: BoDataGridUrlState, requestedQuery: string): BoDataGridUrlState;
  reconcile(urlState: BoDataGridUrlState, urlQuery: string, transitionPending: boolean): boolean;
};

export function createBoDataGridUrlStateBuffer(initial: BoDataGridUrlState): BoDataGridUrlStateBuffer {
  let currentState = initial;
  let expectedQuery: string | null = null;
  return {
    current: () => currentState,
    requestedQuery: () => expectedQuery,
    apply(next, requestedQuery) {
      currentState = next;
      expectedQuery = requestedQuery;
      return currentState;
    },
    reconcile(urlState, urlQuery, transitionPending) {
      if (expectedQuery !== null) {
        if (urlQuery === expectedQuery) {
          if (transitionPending) return false;
          expectedQuery = null;
          return false;
        }
        if (transitionPending) return false;
        expectedQuery = null;
      }
      currentState = urlState;
      return true;
    },
  };
}
