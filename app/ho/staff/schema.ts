import { TddRegistry, type ModuleRow, type TableQuery, type FieldSchema } from "@/lib/workspace-schema";
import type { SurfaceDefinition, SurfaceProvider } from "@/lib/workspace-adapters/contracts";

const read = { display: true, search: true, filter: true, sort: true, group: true, inlineEdit: false } as const;
export const staffFields = [
  { key: "name", label: "Họ tên", type: "text", icon: "Aa", width: 230, permission: "team.bo.access", readOnly: true, capabilities: read },
  { key: "status", label: "Trạng thái", type: "text", icon: "Aa", width: 120, permission: "team.bo.access", readOnly: true, capabilities: read },
  { key: "role", label: "Vai trò", type: "text", icon: "Aa", width: 180, permission: "team.bo.access", readOnly: true, capabilities: read },
] as const satisfies readonly FieldSchema[];
type F = typeof staffFields;
const sections = [{ id: "staff-info", label: "Thông tin Staff", fields: ["name", "status", "role"] }] as const;
export const staffQuery: TableQuery<F> = {
  search: "", filters: { logic: "AND", rules: [] }, sort: { field: "name", direction: "asc" },
  group: null, order: ["name", "status", "role"], visible: ["name", "status", "role"], page: 1, pageSize: 15,
};
export const staffDefinition = {
  version: 1, classification: "TDD_DEFAULT", surface: "HO", key: "staffs", label: "Staff", group: "System",
  fields: staffFields, capabilities: { read: "team.bo.access" },
  table: {
    identity: { field: "name", pinned: "left", hideable: false, reorderable: false },
    columns: [{ field: "name", visible: true }, { field: "status", visible: true }, { field: "role", visible: true }],
    search: { fields: ["name", "status", "role"], normalization: "vi-diacritic-insensitive" },
    filters: { fields: ["name", "status", "role"], mode: "flat", logic: "AND" },
    sort: { fields: ["name", "status", "role"], mode: "single", nulls: "last", tieBreak: "record-id" },
    group: { fields: ["status", "role"], mode: "single" },
    views: { builtIn: [], saved: { kind: "local-ui" }, actions: ["add", "apply", "rename", "delete", "reorder"] },
    pagination: { sizes: [8, 15, 30], defaultSize: 15, mode: "local-ui" },
    inlineEdit: { fields: [], enabled: false },
    interaction: { settings: ["properties", "grouping", "filters", "quick-views"], quickView: "separate-opener", keyboard: "canonical", undo: "local-ui-only" },
  },
  drawer: { density: "one-column", sections, actions: [] },
  detail: {
    overview: { sections: [{ id: "staff-info", label: "Thông tin Staff", fields: ["name", "status"] }] },
    businessTabs: [{
      id: "staff-rate", label: "Rate lương", kind: "form",
      source: { adapter: "salary.staff-rate", permission: "team.bo.access" },
      submitPermission: "staff.compensation.manage",
      fields: ["amount", "effectiveDate", "reason"],
    }],
    history: { kind: "unavailable", reason: "Chưa có nhật ký hệ thống cho Staff." },
  },
} as const satisfies SurfaceDefinition<F>;

type StaffRow = ModuleRow<F>;
type StaffRecord = { id: string; displayLabel: string; status: "active" | "inactive"; roleLabel: string | null };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function loadStaff(fetcher: typeof fetch, signal: AbortSignal): Promise<readonly StaffRow[]> {
  const response = await fetcher("/api/bo/workforce/staff-records", { method: "GET", signal });
  signal.throwIfAborted();
  if (!response.ok) throw Error("Staff directory denied");
  const raw: unknown = await response.json(); signal.throwIfAborted();
  if (!raw || typeof raw !== "object" || !("data" in raw) || !Array.isArray(raw.data)) throw Error("Invalid Staff directory");
  const staff = raw.data as StaffRecord[];
  if (staff.some(row => !row || !uuid.test(row.id) || typeof row.displayLabel !== "string" || !["active","inactive"].includes(row.status) ||
    (row.roleLabel !== null && typeof row.roleLabel !== "string"))) throw Error("Invalid Staff record");
  return staff.map(row => ({ id: row.id, name: row.displayLabel, status: row.status === "active" ? "Đang làm" : "Ngưng", role: row.roleLabel ?? "—" }));
}
export const staffProvider: SurfaceProvider<F> = {
  pagination: "local-ui",
  async list(_query, scope, fetcher, signal) {
    if (scope.surface !== "HO") throw Error("HO only");
    const rows = await loadStaff(fetcher, signal);
    return { records: rows.map(row => ({ row })), total: rows.length };
  },
  async detail(id, scope, fetcher, signal) {
    if (scope.surface !== "HO") throw Error("HO only");
    const rows = await loadStaff(fetcher, signal);
    const row = rows.find(row => row.id === id);
    return row ? { row } : null;
  },
};
/** Local registration validates the authoritative Salary metadata before runtime admission. */
const registry = new TddRegistry();
export const staffSchema = registry.register({
  ...staffDefinition,
  data: {
    id: "salary-ho-staff-read",
    list: async (_query: TableQuery<F>, _context, signal) => { const rows = await loadStaff(fetch, signal); return { rows, total: rows.length }; },
    detail: async (id: string, _context, signal) => (await loadStaff(fetch, signal)).find(row => row.id === id) ?? null,
  },
});
