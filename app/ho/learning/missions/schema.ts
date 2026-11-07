import { TddRegistry, type FieldSchema, type ModuleRow, type TableQuery } from "@/lib/workspace-schema";
import type { SurfaceDefinition, SurfaceProvider } from "@/lib/workspace-adapters/contracts";
import { loadHoA1, mapHoMissions } from "@/lib/ho-a1";
import type { BoRecord } from "@/lib/bo-registration";
import { BoApiError } from "@/lib/bo-api-error";
import { readMissionHistory } from "@/lib/mission-history";
import { loadMissionPathChoices, type MissionPathChoice } from "./mission-path-options";

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
  { key: "createdAt", label: "Created Time", type: "text", icon: "◷", width: 210, permission, readOnly: true, capabilities: read },
  { key: "createdBy", label: "Created by (User)", type: "text", icon: "Aa", width: 225, permission, readOnly: true, capabilities: read },
  { key: "updatedAt", label: "Last Modified Time", type: "text", icon: "◷", width: 210, permission, readOnly: true, capabilities: read },
  { key: "updatedBy", label: "Last Modified By (User)", type: "text", icon: "Aa", width: 235, permission, readOnly: true, capabilities: read },
] as const satisfies readonly FieldSchema[];
type F = typeof missionFields;
// PAP-1188 Founder G0/S3 and Founder-authorized S4 share the exact same ten
// Core-backed property keys in Table, Quick View Drawer and Full Detail.
export const missionTableColumnKeys = ["name", "code", "level", "status", "plsValue", "path",
  "createdAt", "createdBy", "updatedAt", "updatedBy"] as const;
export const missionQuery: TableQuery<F> = {
  search: "", filters: { logic: "AND", rules: [] }, sort: { field: "name", direction: "asc" }, group: null,
  order: [...missionTableColumnKeys], visible: [...missionTableColumnKeys], page: 1, pageSize: 15,
};
export const missionDefinition = {
  version: 1, classification: "TDD_DEFAULT", surface: "HO", key: "missions", label: "Mission", group: "Learning",
  fields: missionFields, capabilities: { read: permission, create: "learning.mission.manage", edit: "learning.mission.manage", history: "learning.mission.manage" },
  actions: [
    { id: "mission-open-create", label: "Tạo mới", slot: "table.header", variant: "primary", capability: "create", handler: "openCreate" },
    { id: "mission-open-edit", label: "Chỉnh sửa", slot: "detail.header", variant: "secondary", capability: "edit", handler: "openEdit" },
    { id: "mission-archive", label: "Lưu trữ", slot: "detail.header", variant: "danger", capability: "edit", handler: "archiveMission" },
    { id: "mission-cancel-create", label: "Hủy", slot: "drawer.footer", formMode: "create", variant: "secondary", capability: "create", handler: "cancelCreate" },
    { id: "mission-save-create", label: "Tạo", slot: "drawer.footer", formMode: "create", variant: "primary", capability: "create", handler: "saveCreate" },
    { id: "mission-cancel-edit", label: "Hủy", slot: "drawer.footer", formMode: "edit", variant: "secondary", capability: "edit", handler: "cancelEdit" },
    { id: "mission-save-edit", label: "Lưu", slot: "drawer.footer", formMode: "edit", variant: "primary", capability: "edit", handler: "saveEdit" },
  ],
  table: {
    identity: { field: "name", pinned: "left", hideable: false, reorderable: false },
    columns: missionTableColumnKeys.map(field => ({ field, visible: true })),
    search: { fields: ["name", "code", "path"], normalization: "vi-diacritic-insensitive" },
    filters: { fields: ["status", "level", "path"], mode: "flat", logic: "AND" },
    sort: { fields: ["name", "code", "status", "level", "plsValue"], mode: "single", nulls: "last", tieBreak: "record-id" },
    group: { fields: ["status", "level"], mode: "single" },
    views: { builtIn: [], saved: { kind: "local-ui" }, actions: ["add", "apply", "rename", "delete", "reorder"] },
    pagination: { sizes: [8, 15, 30], defaultSize: 15, mode: "local-ui" },
    inlineEdit: { enabled: false, fields: [] },
    interaction: { settings: ["properties", "grouping", "filters", "quick-views"], quickView: "separate-opener", keyboard: "canonical", undo: "local-ui-only" },
  },
  drawer: { density: "one-column", sections: [{ id: "mission-summary", label: "Nhiệm vụ", fields: [...missionTableColumnKeys] }], actions: [] },
  detail: {
    overview: { sections: [{ id: "mission-data", label: "Nhiệm vụ", fields: [...missionTableColumnKeys] }] },
    businessTabs: [],
    history: { kind: "unavailable", reason: "Lịch sử cập nhật Mission chưa được kết nối với Core; không tạo dữ liệu thay thế." },
  },
} as const satisfies SurfaceDefinition<F>;

export const missionUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function assertCoreMission(value: unknown): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new BoApiError(502, "Mission source không hợp lệ.", null);
  const m = value as Record<string, unknown>;
  if (!missionUuid.test(String(m.id ?? "")) ||
      typeof m.name !== "string" || !m.name.trim() ||
      typeof m.code !== "string" || !m.code.trim() ||
      !["ACTIVE", "INACTIVE"].includes(String(m.status)) ||
      !Number.isSafeInteger(m.level) || Number(m.level) < 1 || Number(m.level) > 5 ||
      !Number.isSafeInteger(m.plsValue) || Number(m.plsValue) < 0 ||
      !(m.paperSize === null || ["B5", "A4", "A3"].includes(String(m.paperSize)))) {
    throw new BoApiError(502, "Mission source thiếu hoặc sai field.", null);
  }
}
/** Core-confirmed ISO instants only. Render Vietnam-local wall clock precisely. */
export function formatMissionAuditTime(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value))
    return "—";
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit",
    year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(instant);
  const part = (type: string) => parts.find(p => p.type === type)?.value ?? "";
  return part("day") + "/" + part("month") + "/" + part("year") + " · " +
    part("hour") + ":" + part("minute");
}
/** Only the Core field explicitly bound to verified legal name is displayable. */
export function missionVerifiedActorName(value: unknown): string {
  if (typeof value !== "string") return "—";
  const name = value.trim();
  if (!name || name.length > 160 || name.includes("@") ||
      /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(name) || /^\d+$/.test(name))
    return "—";
  return name;
}
function missionPathLabel(raw: BoRecord, choices: readonly MissionPathChoice[]): string {
  return choices.find(c => c.id === raw.pathProgramId && c.code === raw.pathKeySnapshot)?.label ?? "—";
}
function project(raw: BoRecord, paths: readonly MissionPathChoice[] = []): ModuleRow<F> {
  if (!missionUuid.test(String(raw.id ?? "")) || typeof raw.name !== "string" || !raw.name.trim() ||
      typeof raw.code !== "string" || !raw.code.trim() || !["ACTIVE", "INACTIVE"].includes(String(raw.status)) ||
      (!Number.isInteger(raw.level) || Number(raw.level) < 1 || Number(raw.level) > 5) ||
      !Number.isSafeInteger(raw.plsValue) || Number(raw.plsValue) < 0 ||
      (raw.paperSize !== null && raw.paperSize !== "" && !["B5", "A4", "A3"].includes(String(raw.paperSize)))) {
    throw new BoApiError(502, "Mission catalog không đúng contract.", null);
  }
  return {
    id: String(raw.id), name: String(raw.name), code: String(raw.code),
    level: typeof raw.level === "number" && raw.level > 0 ? raw.level : null,
    status: String(raw.status), plsValue: typeof raw.plsValue === "number" ? raw.plsValue : 0,
    paperSize: typeof raw.paperSize === "string" ? raw.paperSize : null,
    path: missionPathLabel(raw, paths),
    createdAt: formatMissionAuditTime(raw.createdAt),
    createdBy: missionVerifiedActorName(raw.createdByVerifiedLegalName),
    updatedAt: formatMissionAuditTime(raw.updatedAt),
    updatedBy: missionVerifiedActorName(raw.updatedByVerifiedLegalName),
    prerequisite: typeof raw.prerequisite === "string" ? raw.prerequisite : null,
    description: typeof raw.description === "string" ? raw.description : null,
    guideline: typeof raw.guideline === "string" ? raw.guideline : null,
  };
}
export function projectMission(raw: BoRecord, paths: readonly MissionPathChoice[] = []): ModuleRow<F> { return project(raw, paths); }
export const missionProvider: SurfaceProvider<F> = {
  pagination: "local-ui",
  async list(_query, scope, fetcher, signal) {
    if (scope.surface !== "HO") throw new BoApiError(403, "HO Global scope required.", null);
    const records = await loadHoA1("missions", async (input, init) => {
      const response = await fetcher(input, { ...init, signal, cache: "no-store" });
      signal.throwIfAborted();
      if (response.ok) {
        const body: unknown = await response.clone().json().catch(() => null);
        if (!body || typeof body !== "object" || !("data" in body) || !Array.isArray(body.data)) {
          throw new BoApiError(502, "Mission catalog không đúng envelope.", null);
        }
        for (const source of body.data) assertCoreMission(source);
      }
      return response;
    });
    signal.throwIfAborted();
    if (new Set(records.map(r => r.id)).size !== records.length)
      throw new BoApiError(502, "Mission catalog có ID trùng.", null);
    const paths = await loadMissionPathChoices(fetcher, signal);
    signal.throwIfAborted();
    const rows = records.map(raw => project(raw, paths));
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
    assertCoreMission(json.data);
    const records = mapHoMissions([json.data]);
    if (String(records[0]?.id ?? "").toLowerCase() !== id.toLowerCase())
      throw new BoApiError(502, "Mission ID không khớp.", null);
    const paths = await loadMissionPathChoices(fetcher, signal);
    signal.throwIfAborted();
    const row = project(records[0]!, paths);
    return { row };
  },
  history: { subjectType: "learning_mission", bind: (fetcher, scope) => ({
    kind: "provider", source: { adapter: "core-ho-mission-history", permission: "learning.mission.manage" },
    load: (subject, context, cursor, signal) => {
      if (scope.surface !== "HO" || context.surface !== "HO" || subject.type !== "learning_mission")
        return Promise.resolve({ status: "denied" as const });
      return readMissionHistory(fetcher,
        "/api/ho/learning/missions/" + encodeURIComponent(subject.id) + "/history",
        subject, cursor, signal);
    },
  }) },
};
const missionRegistry = new TddRegistry();
export const missionSchema = missionRegistry.register({ ...missionDefinition, data: {
  id: "ho-core-global-mission-catalog-readonly",
  list: async () => { throw new Error("Requires authenticated HO mission adapter"); },
  detail: async () => { throw new Error("Requires authenticated HO mission adapter"); },
} });
