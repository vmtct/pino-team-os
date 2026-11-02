import type { BoFilterField } from "./bo-filter-settings-state";

/** Public student directory schema only; never derive a field list from a private record. */
export const BO_STUDENT_PILOT_FIELDS: readonly BoFilterField[] = [
  { key: "name", type: "text", filterable: true },
  { key: "id", type: "text", filterable: true },
  { key: "birth", type: "text", filterable: false },
  { key: "paths", type: "text", filterable: false },
  { key: "learning", type: "text", filterable: true },
  { key: "member", type: "boolean", filterable: false },
  { key: "attention", type: "text", filterable: false },
] as const;
export const BO_STUDENT_PILOT_DEFAULT_COLUMNS = BO_STUDENT_PILOT_FIELDS.map((field) => field.key);
export function studentPilotFilterRow(student: { displayName: string; activeSubscriptions: number }): Record<string, unknown> {
  return { name: student.displayName, learning: student.activeSubscriptions > 0 ? "active" : "inactive" };
}