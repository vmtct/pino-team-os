import { applyBoFilterSettings, type BoFilterField, type BoFilterSettings } from "./bo-filter-settings-state";
import type { RunningClassGridRow } from "./bo-running-classes-grid";

/** Apply typed filters before pagination, against canonical flattened display fields. */
export const runningClassFilterFields: readonly BoFilterField[] = [
  { key: "class", type: "text", filterable: true },
  { key: "program", type: "text", filterable: true },
  { key: "pattern", type: "text", filterable: true },
  { key: "capacity", type: "text", filterable: true },
  { key: "status", type: "text", filterable: true },
  { key: "id", type: "text", filterable: true },
];

export function filterRunningClassGridRows(rows: readonly RunningClassGridRow[], settings: BoFilterSettings): RunningClassGridRow[] {
  const flattened = rows.map((row) => ({
    class: row.item.operationalName,
    program: row.programName,
    pattern: row.patternLabel,
    capacity: row.capacityLabel,
    status: row.item.status,
    id: row.item.id,
  }));
  const filtered = applyBoFilterSettings(flattened, settings, runningClassFilterFields);
  const ids = new Set(filtered.map((row) => row.id));
  return rows.filter((row) => ids.has(row.item.id));
}
