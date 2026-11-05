import type { BoFilterField, BoFilterSettings } from "./bo-filter-settings-state";
import type { BoTypedFilterOperator } from "./bo-typed-filter";
import type { BoViewConfig, BoViewFilter, BoViewOperator } from "./bo-public-view-state";

const toPersistent: Record<BoTypedFilterOperator, BoViewOperator> = {
  contains: "contains", not_contains: "not_contains", equals: "equals",
  not_equals: "is_not", is_empty: "empty", is_not_empty: "not_empty",
};
const toLocal: Partial<Record<BoViewOperator, BoTypedFilterOperator>> = {
  contains: "contains", not_contains: "not_contains", equals: "equals",
  is: "equals", is_not: "not_equals", empty: "is_empty", not_empty: "is_not_empty",
};

/** Reject unsupported view semantics rather than displaying a misleading partial view. */
export function fromSharedViewConfig(config: BoViewConfig, fields: readonly BoFilterField[], sortable: readonly string[]): {
  typed: BoFilterSettings; order: readonly string[]; search: string;
  sortKey: string | null; sortDirection: "asc" | "desc";
} {
  if (config.groupBy) throw new Error("View này có nhóm dữ liệu chưa được hỗ trợ trên bảng pilot.");
  const allowed = new Set(fields.map((x) => x.key));
  if (config.sort && !sortable.includes(config.sort.field))
    throw new Error("View có trường sắp xếp chưa được hỗ trợ trên bảng pilot.");
  if (config.columns.visible.some((x) => !allowed.has(x)) ||
      config.columns.order.some((x) => !allowed.has(x)))
    throw new Error("View chứa cột không được phép hiển thị.");
  const filters = config.filters.map((f) => {
    const field = fields.find((x) => x.key === f.field);
    const op = toLocal[f.operator];
    if (!field?.filterable || !op || (f.value !== undefined && typeof f.value !== "string" &&
      typeof f.value !== "number" && typeof f.value !== "boolean"))
      throw new Error("View chứa bộ lọc chưa được hỗ trợ; không thể áp dụng một phần.");
    return { field: f.field, operator: op, value: f.value == null ? "" : String(f.value) };
  });
  const typed = { group: { combinator: config.logic, filters }, visibleKeys: config.columns.visible };
  return { typed, order: config.columns.order, search: config.search,
    sortKey: config.sort?.field ?? null, sortDirection: config.sort?.direction ?? "asc" };
}

export function toSharedViewConfig(base: BoViewConfig, typed: BoFilterSettings,
  search: string, sortKey: string | null, sortDirection: "asc" | "desc", order: readonly string[]): BoViewConfig {
  const filters: BoViewFilter[] = typed.group.filters.map((x) => ({
    field: x.field, operator: toPersistent[x.operator],
    ...(["is_empty", "is_not_empty"].includes(x.operator) ? {} : { value: x.value ?? "" }),
  }));
  return { ...base, search, sort: sortKey ? { field: sortKey, direction: sortDirection } : null,
    filters, logic: typed.group.combinator, columns: { order: [...order], visible: [...typed.visibleKeys] } };
}
