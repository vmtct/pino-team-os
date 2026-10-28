import { display, empty, norm, tableRows, type BoField, type BoRecord, type BoTableState } from "@/lib/bo-registration";
import type { TablePolicy } from "./TablePolicy";
/** Reuse the legacy flat rule evaluator; registered search and deterministic single sort. */
export function registeredTableRows(rows: readonly BoRecord[], fields: readonly BoField[], state: BoTableState, policy: TablePolicy) {
  const searchable = fields.filter(f => policy.search.includes(f.key));
  const input = state.search ? rows.filter(row => searchable.some(f => norm(display(row[f.key])).includes(norm(state.search)))) : rows;
  const found = tableRows(input, fields, { ...state, search: "", sort: "" });
  if (state.sort) {
    const field = fields.find(f => f.key === state.sort);
    found.sort((a, b) => {
      const left = a[state.sort], right = b[state.sort];
      if (empty(left) !== empty(right)) return empty(left) ? 1 : -1;
      let order = 0;
      if (!empty(left)) order = field && ["number", "currency", "formula"].includes(field.type) ? Number(left) - Number(right)
        : field && ["date", "datetime"].includes(field.type) ? Date.parse(String(left)) - Date.parse(String(right))
          : display(left).localeCompare(display(right), "vi", { numeric: true });
      return (state.desc ? -order : order) || a.id.localeCompare(b.id);
    });
  }
  return found;
}
