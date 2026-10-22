export type BoTypedFilterOperator = "contains" | "not_contains" | "equals" | "not_equals" | "is_empty" | "is_not_empty";
export type BoTypedFilter = Readonly<{ field: string; operator: BoTypedFilterOperator; value?: string }>;
export type BoTypedFilterGroup = Readonly<{ combinator: "and" | "or"; filters: readonly BoTypedFilter[] }>;

export function matchesBoTypedFilter(row: Readonly<Record<string, unknown>>, filter: BoTypedFilter): boolean {
  if (!Object.prototype.hasOwnProperty.call(row, filter.field)) return false;
  const raw = row[filter.field];
  const empty = raw == null || raw === "" || (Array.isArray(raw) && raw.length === 0);
  if (filter.operator === "is_empty") return empty;
  if (filter.operator === "is_not_empty") return !empty;
  if (filter.value === undefined) return false;
  const actual = String(raw ?? "").toLocaleLowerCase();
  const expected = filter.value.toLocaleLowerCase();
  switch (filter.operator) {
    case "contains": return actual.includes(expected);
    case "not_contains": return !actual.includes(expected);
    case "equals": return actual === expected;
    case "not_equals": return actual !== expected;
    default: return false;
  }
}

export function matchesBoTypedFilterGroup(row: Readonly<Record<string, unknown>>, group: BoTypedFilterGroup): boolean {
  if (!group.filters.length) return true;
  return group.combinator === "and"
    ? group.filters.every((filter) => matchesBoTypedFilter(row, filter))
    : group.filters.some((filter) => matchesBoTypedFilter(row, filter));
}
