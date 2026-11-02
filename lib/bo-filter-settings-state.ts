import { matchesBoTypedFilterGroup, type BoTypedFilterGroup, type BoTypedFilterOperator } from "./bo-typed-filter";

export type BoFilterField = Readonly<{ key: string; type: "text" | "number" | "boolean" | "date"; filterable: boolean }>;
export type BoFilterSettings = Readonly<{ group: BoTypedFilterGroup; visibleKeys: readonly string[] }>;
const supported: Readonly<Record<BoFilterField["type"], readonly BoTypedFilterOperator[]>> = {
  text: ["contains", "not_contains", "equals", "not_equals", "is_empty", "is_not_empty"],
  number: ["equals", "not_equals", "is_empty", "is_not_empty"],
  boolean: ["equals", "not_equals", "is_empty", "is_not_empty"],
  date: ["equals", "not_equals", "is_empty", "is_not_empty"],
};
export function validateBoFilterSettings(settings: BoFilterSettings, fields: readonly BoFilterField[]): boolean {
  const keys = new Set<string>();
  for (const field of fields) {
    if (!field.key || keys.has(field.key)) return false;
    keys.add(field.key);
  }
  if (new Set(settings.visibleKeys).size !== settings.visibleKeys.length || settings.visibleKeys.some((key) => !keys.has(key))) return false;
  return settings.group.filters.every((filter) => {
    const field = fields.find((candidate) => candidate.key === filter.field);
    if (!field?.filterable || !supported[field.type].includes(filter.operator)) return false;
    if (filter.operator === "is_empty" || filter.operator === "is_not_empty") return true;
    if (filter.value === undefined) return false;
    if (field.type === "number") return filter.value.trim() !== "" && Number.isFinite(Number(filter.value));
    if (field.type === "boolean") return filter.value === "true" || filter.value === "false";
    return true;
  });
}
export function applyBoFilterSettings<Row extends Record<string, unknown>>(
  rows: readonly Row[], settings: BoFilterSettings, fields: readonly BoFilterField[],
): readonly Row[] {
  if (!validateBoFilterSettings(settings, fields)) return [];
  return rows.filter((row) => matchesBoTypedFilterGroup(row, settings.group));
}