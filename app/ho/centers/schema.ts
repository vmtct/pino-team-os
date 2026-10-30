import { TddRegistry, type FieldSchema, type TableQuery } from "@/lib/workspace-schema";
import { adapterError } from "@/lib/workspace-adapters/session";
import type { SurfaceDefinition } from "@/lib/workspace-adapters";
import { hoCentersProvider } from "@/lib/workspace-adapters";
const read = { display: true, search: true, filter: true, sort: true, group: true, inlineEdit: false } as const;
export const centerFields = [
  { key: "name", label: "Display Name", type: "text", icon: "Aa", width: 240, permission: "bo.operations.view", readOnly: true, capabilities: read },
  { key: "id", label: "ID", type: "id", icon: "#", width: 300, permission: "bo.operations.view", readOnly: true, capabilities: { ...read, search: false, filter: false, sort: false, group: false } },
  { key: "centerKey", label: "Center Key", type: "text", icon: "Aa", width: 180, permission: "bo.operations.view", readOnly: true, capabilities: read },
  { key: "timeZone", label: "Time Zone", type: "text", icon: "Aa", width: 210, permission: "bo.operations.view", readOnly: true, capabilities: read },
  { key: "status", label: "Status", type: "text", icon: "Aa", width: 120, permission: "bo.operations.view", readOnly: true, capabilities: read },
] as const satisfies readonly FieldSchema[];
type F = typeof centerFields;
const sections = [{ id: "center-info", label: "Thông tin Center", fields: ["name", "id", "centerKey", "timeZone", "status"] }] as const;
const searchable = ["name", "centerKey", "timeZone", "status"] as const;
export const centerQuery: TableQuery<F> = { search: "", filters: { logic: "AND", rules: [] }, sort: { field: "name", direction: "asc" }, group: null, order: ["name", "id", "centerKey", "timeZone", "status"], visible: ["name", "centerKey", "timeZone", "status"], page: 1, pageSize: 15 };
export const centerDefinition = {
  version: 1, classification: "TDD_DEFAULT", surface: "HO", key: "centers", label: "Centers", group: "Network", fields: centerFields,
  capabilities: { read: "bo.operations.view" },
  table: {
    identity: { field: "name", pinned: "left", hideable: false, reorderable: false }, columns: centerFields.map(f => ({ field: f.key, visible: f.key !== "id" })),
    search: { fields: searchable, normalization: "vi-diacritic-insensitive" }, filters: { fields: searchable, mode: "flat", logic: "AND" },
    sort: { fields: searchable, mode: "single", nulls: "last", tieBreak: "record-id" }, group: { fields: ["status", "timeZone"], mode: "single" },
    views: { builtIn: [], saved: { kind: "local-ui" }, actions: ["add", "apply", "rename", "delete", "reorder"] },
    pagination: { sizes: [8, 15, 30], defaultSize: 15, mode: "local-ui" }, inlineEdit: { fields: [], enabled: false },
    interaction: { settings: ["properties", "grouping", "filters", "quick-views"], quickView: "separate-opener", keyboard: "canonical", undo: "local-ui-only" },
  },
  drawer: { density: "one-column", sections, actions: [] },
  detail: { overview: { sections }, businessTabs: [], history: { kind: "unavailable", reason: "Chưa có lịch sử khả dụng cho Center." } },
} as const satisfies SurfaceDefinition<F>;
/** Existing server-authorized Center directory; no new endpoint or data source. */
export const centerProvider = hoCentersProvider<F>(row => ({ id: row.id, name: row.name, centerKey: row.centerKey, timeZone: row.timeZone, status: row.status }));
const hoScope = (surface: "BO" | "HO") => { if (surface !== "HO") throw adapterError(403); return { surface: "HO" } as const; };
const registry = new TddRegistry();
export const centerSchema = registry.register({ ...centerDefinition, data: { id: "ho-centers-directory", list: async (_query, context, signal) => { const result = await centerProvider.list(centerQuery, hoScope(context.surface), fetch, signal); return { rows: result.records.map(r => r.row), total: result.total }; }, detail: async (id, context, signal) => (await centerProvider.detail(id, hoScope(context.surface), fetch, signal))?.row ?? null } });
