import { TddRegistry, type FieldSchema, type ModuleRow, type TableQuery } from "@/lib/workspace-schema";
import type { SurfaceDefinition, SurfaceProvider } from "@/lib/workspace-adapters/contracts";
import { loadHoA1, mapHoMissions } from "@/lib/ho-a1";
import type { BoRecord } from "@/lib/bo-registration";
import { BoApiError } from "@/lib/bo-api-error";

const read = { display: true, search: true, filter: true, sort: true, group: true, inlineEdit: false } as const;
const permission = "catalog.learning.view";
export const missionFields = [
  { key: "name", label: "Nhiệm vụ", type: "text", icon: "Aa", width: 235, permission, readOnly: true, capabilities: read },
  { key: "code", label: "Mã", type: "text", icon: "#", width: 145, permission, readOnly: true, capabilities: read },
  { key: "level", label: "Cấp độ", type: "number", icon: "#", width: 115, permission, readOnly: true, capabilities: read },
  { key: "status", label: "Trạng thái", type: "text", icon: "Aa", width: 145, permission, readOnly: true, capabilities: read },
  { key: "plsValue", label: "PLS", type: "number", icon: "#", width: 100, permission, readOnly: true, capabilities: read },
  { key: "paperSize", label: "Khổ giấy", type: "text", icon: "Aa", width: 110, permission, readOnly: true, capabilities: read },
  { key: "path", label: "Path", type: "text", icon: "Aa", width: 220, permission, readOnly: true, capabilities: read },
  { key: "prerequisite", label: "Điều kiện trước", type: "text", icon: "Aa", width: 220, permission, readOnly: true, capabilities: read },
  { key: "description", label: "Mô tả", type: "text", icon: "Aa", width: 290, permission, readOnly: true, capabilities: read },
  { key: "guideline", label: "Hướng dẫn", type: "text", icon: "Aa", width: 290, permission, readOnly: true, capabilities: read },
  { key: "id", label: "Mission ID", type: "id", icon: "#", width: 285, permission, readOnly: true, capabilities: read },
] as const satisfies readonly FieldSchema[];
type F = typeof missionFields;
const fieldKeys = missionFields.map(f => f.key);
export const missionQuery: TableQuery<F> = {
  search: "", filters: { logic: "AND", rules: [] }, sort: { field: "name", direction: "asc" }, group: null,
  order: fieldKeys, visible: ["name", "code", "level", "status", "plsValue", "paperSize", "path"], page: 1, pageSize: 15,
};
export const missionDefinition = {
  version: 1, classification: "TDD_DEFAULT", surface: "HO", key: "missions", label: "Mission", group: "Learning",
  fields: missionFields, capabilities: { read: permission },
  table: {
    identity: { field: "name", pinned: "left", hideable: false, reorderable: false },
    columns: missionFields.map(f => ({ field: f.key, visible: missionQuery.visible.includes(f.key) })),
    search: { fields: ["name", "code", "description", "path"], normalization: "vi-diacritic-insensitive" },
    filters: { fields: ["status", "level", "paperSize", "path"], mode: "flat", logic: "AND" },
    sort: { fields: ["name", "code", "status", "level", "plsValue"], mode: "single", nulls: "last", tieBreak: "record-id" },
    group: { fields: ["status", "level"], mode: "single" },
    views: { builtIn: [], saved: { kind: "local-ui" }, actions: ["add", "apply", "rename", "delete", "reorder"] },
    pagination: { sizes: [8, 15, 30], defaultSize: 15, mode: "local-ui" },
    inlineEdit: { enabled: false, fields: [] },
    interaction: { settings: ["properties", "grouping", "filters", "quick-views"], quickView: "separate-opener", keyboard: "canonical", undo: "local-ui-only" },
  },
  drawer: { density: "one-column", sections: [{ id: "mission-summary", label: "Mission", fields: ["name", "code", "status", "level", "plsValue", "paperSize", "path"] }], actions: [] },
  detail: {
    overview: { sections: [{ id: "mission-data", label: "Mission Definition", fields: fieldKeys }] },
    businessTabs: [],
    history: { kind: "unavailable", reason: "Lịch sử cập nhật Mission chưa được kết nối với Core; không tạo dữ liệu thay thế." },
  },
} as const satisfies SurfaceDefinition<F>;

export const missionUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function project(raw: BoRecord): ModuleRow<F> {
  if (!missionUuid.test(String(raw.id ?? "")) || typeof raw.name !== "string" || !raw.name.trim() ||
      typeof raw.code !== "string" || !raw.code.trim() || !["ACTIVE", "INACTIVE"].includes(String(raw.status)) ||
      (raw.level !== 0 && (!Number.isInteger(raw.level) || Number(raw.level) < 1 || Number(raw.level) > 5)) ||
      !Number.isSafeInteger(raw.plsValue) || Number(raw.plsValue) < 0 ||
      (raw.paperSize !== null && raw.paperSize !== "" && !["B5", "A4", "A3"].includes(String(raw.paperSize)))) {
    throw new BoApiError(502, "Mission catalog không đúng contract.", null);
  }
  return {
    id: String(raw.id), name: raw.name, code: raw.code, level: raw.level === 0 ? null : raw.level,
    status: raw.status, plsValue: raw.plsValue, paperSize: raw.paperSize ?? null, path: raw.path ?? null,
    prerequisite: raw.prerequisite ?? null, description: raw.description ?? null, guideline: raw.guideline ?? null,
  };
}
export function projectMission(raw: BoRecord): ModuleRow<F> { return project(raw); }
export const missionProvider: SurfaceProvider<F> = {
  pagination: "local-ui",
  async list(_query, scope, fetcher, signal) {
    if (scope.surface !== "HO") throw new BoApiError(403, "HO Global scope required.", null);
    const records = await loadHoA1("missions", async (input, init) =>
      fetcher(input, { ...init, signal, cache: "no-store" }));
    signal.throwIfAborted();
    const rows = records.map(project);
    if (new Set(rows.map(r => r.id)).size !== rows.length) throw new BoApiError(502, "Mission catalog có ID trùng.", null);
    return { records: rows.map(row => ({ row })), total: rows.length };
  },
  async detail(id, scope, fetcher, signal) {
    if (scope.surface !== "HO") throw new BoApiError(403, "HO Global scope required.", null);
    if (!missionUuid.test(id)) throw new BoApiError(400, "Mission ID không hợp lệ.", null);
    const response = await fetcher("/api/bo/learning/missions/" + id, { method: "GET", cache: "no-store", signal });
    signal.throwIfAborted();
    if (response.status === 404) return null;
    if (!response.ok) throw new BoApiError(response.status, "Không đọc được Mission.", response.headers.get("x-request-id"));
    const json: unknown = await response.json();
    signal.throwIfAborted();
    if (!json || typeof json !== "object" || !("data" in json) || !json.data ||
        typeof json.data !== "object" || Array.isArray(json.data)) throw new BoApiError(502, "Mission detail thiếu dữ liệu.", null);
    const records = mapHoMissions([json.data]);
    const row = project(records[0]!);
    if (row.id.toLowerCase() !== id.toLowerCase()) throw new BoApiError(502, "Mission ID không khớp.", null);
    return { row };
  },
};
const missionRegistry = new TddRegistry();
export const missionSchema = missionRegistry.register({ ...missionDefinition, data: {
  id: "ho-core-global-mission-catalog-readonly",
  list: async () => { throw new Error("Requires authenticated HO mission adapter"); },
  detail: async () => { throw new Error("Requires authenticated HO mission adapter"); },
} });
