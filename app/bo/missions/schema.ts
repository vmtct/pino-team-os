import { TddRegistry, type FieldSchema, type ModuleRow, type TableQuery } from "@/lib/workspace-schema";
import type { SurfaceDefinition, SurfaceProvider } from "@/lib/workspace-adapters/contracts";
import { readMissionAssignment, readMissionAssignments, type MissionAssignment } from "@/lib/bo-mission-assignments";

const read = { display: true, search: true, filter: true, sort: true, group: true, inlineEdit: false } as const;
const permission = "student.mission_assignment.view";
export const assignmentFields = [
  { key: "name", label: "Nhiệm vụ", type: "text", icon: "Aa", width: 235, permission, readOnly: true, capabilities: read },
  { key: "code", label: "Mã Mission", type: "text", icon: "#", width: 160, permission, readOnly: true, capabilities: read },
  { key: "student", label: "Student ID", type: "text", icon: "#", width: 280, permission, readOnly: true, capabilities: read },
  { key: "status", label: "Trạng thái", type: "text", icon: "Aa", width: 135, permission, readOnly: true, capabilities: read },
  { key: "context", label: "Bối cảnh", type: "text", icon: "Aa", width: 200, permission, readOnly: true, capabilities: read },
  { key: "assignedAt", label: "Ngày giao (UTC)", type: "text", icon: "Aa", width: 200, permission, readOnly: true, capabilities: read },
  { key: "center", label: "Center ID", type: "text", icon: "#", width: 280, permission, readOnly: true, capabilities: read },
  { key: "mission", label: "Mission ID", type: "text", icon: "#", width: 280, permission, readOnly: true, capabilities: read },
  { key: "contextKey", label: "Context Key", type: "text", icon: "#", width: 160, permission, readOnly: true, capabilities: read },
  { key: "cancelledAt", label: "Ngày hủy (UTC)", type: "text", icon: "Aa", width: 200, permission, readOnly: true, capabilities: read },
  { key: "cancelledReason", label: "Lý do hủy", type: "text", icon: "Aa", width: 200, permission, readOnly: true, capabilities: read },
] as const satisfies readonly FieldSchema[];
type F = typeof assignmentFields;
export const assignmentQuery: TableQuery<F> = {
  search: "", filters: { logic: "AND", rules: [] }, sort: { field: "assignedAt", direction: "desc" }, group: null,
  order: assignmentFields.map(f => f.key), visible: ["name", "code", "student", "status", "context", "assignedAt"], page: 1, pageSize: 15,
};
export const assignmentDefinition = {
  version: 1, classification: "TDD_DEFAULT", surface: "BO", key: "missions", label: "Nhiệm vụ", group: "SCHOOL",
  fields: assignmentFields, capabilities: { read: permission,
    create: "student.mission_assignment.manage", edit: "student.mission_assignment.manage" },
  actions: [
    { id: "assignment-open-create", label: "Giao Nhiệm vụ", slot: "table.header", variant: "primary", capability: "create", handler: "openCreate" },
    { id: "assignment-open-edit", label: "Sửa", slot: "detail.header", variant: "secondary", capability: "edit", handler: "openEdit" },
    { id: "assignment-open-cancel", label: "Hủy giao", slot: "detail.header", variant: "danger", capability: "edit", handler: "openCancel" },
    { id: "assignment-cancel-create", label: "Đóng", slot: "drawer.footer", formMode: "create", variant: "secondary", capability: "create", handler: "cancelCreate" },
    { id: "assignment-save-create", label: "Giao", slot: "drawer.footer", formMode: "create", variant: "primary", capability: "create", handler: "saveCreate" },
    { id: "assignment-cancel-edit", label: "Đóng", slot: "drawer.footer", formMode: "edit", variant: "secondary", capability: "edit", handler: "cancelEdit" },
    { id: "assignment-save-edit", label: "Lưu", slot: "drawer.footer", formMode: "edit", variant: "primary", capability: "edit", handler: "saveEdit" },
    { id: "assignment-confirm-cancel", label: "Xác nhận hủy", slot: "drawer.footer", formMode: "edit", variant: "danger", capability: "edit", handler: "confirmCancel" },
  ],
  table: {
    identity: { field: "name", pinned: "left", hideable: false, reorderable: false },
    columns: assignmentFields.map(f => ({ field: f.key, visible: assignmentQuery.visible.includes(f.key) })),
    search: { fields: ["name", "code", "student", "context"], normalization: "vi-diacritic-insensitive" },
    filters: { fields: ["status", "student", "code"], mode: "flat", logic: "AND" },
    sort: { fields: ["name", "code", "student", "status", "assignedAt"], mode: "single", nulls: "last", tieBreak: "record-id" },
    group: { fields: ["status", "student"], mode: "single" },
    views: { builtIn: [
      { id: "all", label: "Tất cả", state: assignmentQuery },
      { id: "assigned", label: "Đang giao", state: { ...assignmentQuery, filters: { logic: "AND", rules: [{ field: "status", op: "eq", value: "Đang giao" }] } } },
      { id: "cancelled", label: "Đã hủy", state: { ...assignmentQuery, filters: { logic: "AND", rules: [{ field: "status", op: "eq", value: "Đã hủy" }] } } },
    ], saved: { kind: "local-ui" }, actions: ["add", "apply", "rename", "delete", "reorder"] },
    pagination: { sizes: [8, 15, 30], defaultSize: 15, mode: "local-ui" },
    inlineEdit: { fields: [], enabled: false },
    interaction: { settings: ["properties", "grouping", "filters", "quick-views"], quickView: "separate-opener", keyboard: "canonical", undo: "local-ui-only" },
  },
  drawer: { density: "one-column", sections: [{ id: "summary", label: "Nhiệm vụ được giao", fields: ["student", "name", "code", "status", "assignedAt", "context"] }], actions: [] },
  detail: {
    overview: { sections: [{ id: "assignment", label: "Nhiệm vụ được giao", fields: ["student", "name", "code", "status", "assignedAt", "context", "contextKey", "center", "mission", "cancelledAt", "cancelledReason"] }] },
    businessTabs: [
      { id: "results", label: "Kết quả", kind: "relation-grid", relatedModule: "student-mission-results", source: { adapter: "mission-results-unavailable", permission } },
      { id: "diary", label: "Nhật Ký", kind: "relation-grid", relatedModule: "assignment-diaries", source: { adapter: "assignment-diary-unavailable", permission } },
    ],
    history: { kind: "unavailable", reason: "Chưa có nguồn lịch sử được cấp quyền cho Nhiệm vụ này. Không tạo nhật ký thay thế." },
  },
} as const satisfies SurfaceDefinition<F>;
function project(p: MissionAssignment): ModuleRow<F> {
  return { id: p.id, name: p.missionNameSnapshot, code: p.missionCodeSnapshot, student: p.studentId,
    status: p.status === "ASSIGNED" ? "Đang giao" : "Đã hủy", context: p.contextLabel, assignedAt: p.assignedAt,
    center: p.centerId, mission: p.missionId, contextKey: p.contextKey, cancelledAt: p.cancelledAt, cancelledReason: p.cancelledReason };
}
export const assignmentProvider: SurfaceProvider<F> = {
  pagination: "local-ui",
  async list(_query, scope, fetcher, signal) {
    if (scope.surface !== "BO") throw Error("BO Center scope required");
    const rows = await readMissionAssignments(fetcher, scope.centerId, signal);
    return { records: rows.map(p => ({ row: project(p), centerId: p.centerId, version: String(p.version) })), total: rows.length };
  },
  async detail(id, scope, fetcher, signal) {
    if (scope.surface !== "BO") throw Error("BO Center scope required");
    const p = await readMissionAssignment(fetcher, scope.centerId, id, signal);
    return p ? { row: project(p), centerId: p.centerId, version: String(p.version) } : null;
  },
};
const missionRegistry = new TddRegistry();
export const assignmentSchema = missionRegistry.register({ ...assignmentDefinition, data: {
  id: "bo-mission-assignment-center-bound",
  list: async () => { throw Error("Requires authenticated Center-scoped TDD adapter"); },
  detail: async () => { throw Error("Requires authenticated Center-scoped TDD adapter"); },
} });
