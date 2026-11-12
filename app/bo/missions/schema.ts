import { TddRegistry, type FieldSchema, type ModuleRow, type TableQuery } from "@/lib/workspace-schema";
import type { SurfaceDefinition, SurfaceProvider } from "@/lib/workspace-adapters/contracts";
import { assignmentUuid, readMissionAssignment, readMissionAssignments, type MissionAssignment } from "@/lib/bo-mission-assignments";
import { readMissionHistory } from "@/lib/mission-history";
import { readBoMissionExecution, type BoMissionExecution } from "@/lib/bo-mission-completion-client";
import { formatMissionAuditTime } from "@/lib/bo-mission-audit-projection";


/** PAP-1849: source-verified BO student name. Never expose an ID as a display fallback. */
export async function readAuthorizedMissionStudentNames(
  fetcher: typeof fetch, centerId: string, signal: AbortSignal,
): Promise<ReadonlyMap<string,string>> {
  if (!assignmentUuid.test(centerId)) throw Error("Cơ sở chưa được xác thực.");
  const names = new Map<string,string>(), seen = new Set<string>();
  let beforeStudentId: string | null = null;
  for (let page = 0; page < 100; page++) {
    const params = new URLSearchParams({ limit: "100", centerId });
    if (beforeStudentId) params.set("beforeStudentId", beforeStudentId);
    const response = await fetcher("/api/bo/learners?" + params,
      { method: "GET", credentials: "same-origin", cache: "no-store", redirect: "error", signal });
    signal.throwIfAborted();
    if (!response.ok) throw Error("Không thể đọc tên học viên trong cơ sở hiện tại.");
    const envelope: unknown = await response.json();
    signal.throwIfAborted();
    if (!envelope || typeof envelope !== "object" || !("data" in envelope) ||
        !Array.isArray(envelope.data) || envelope.data.length > 100) throw Error("Nguồn học viên không hợp lệ.");
    const rows: unknown[] = envelope.data;
    for (const value of rows) {
      if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("Bản ghi học viên không hợp lệ.");
      const row = value as Record<string, unknown>;
      if (typeof row.id !== "string" || !assignmentUuid.test(row.id) || seen.has(row.id))
        throw Error("Danh bạ học viên trùng hoặc sai ID.");
      seen.add(row.id);
      if (typeof row.displayName === "string" && row.displayName.trim()) names.set(row.id, row.displayName.trim());
    }
    if (rows.length < 100) return names;
    const last = rows.at(-1) as { id: string };
    if (!last.id || last.id === beforeStudentId) throw Error("Phân trang học viên không tiến.");
    beforeStudentId = last.id;
  }
  throw Error("Vượt giới hạn phân trang học viên.");
}

const read = { display: true, search: true, filter: true, sort: true, group: true, inlineEdit: false } as const;
const permission = "student.mission_assignment.view";
export const assignmentFields = [
  { key: "name", label: "Nhiệm vụ", type: "text", icon: "Aa", width: 235, permission, readOnly: true, capabilities: read },
  { key: "code", label: "Mã Mission", type: "text", icon: "#", width: 160, permission, readOnly: true, capabilities: read },
  { key: "student", label: "Student", type: "text", icon: "Aa", width: 280, permission, readOnly: true, capabilities: read },
  { key: "status", label: "Trạng thái", type: "text", icon: "Aa", width: 135, permission, readOnly: true, capabilities: read },
  { key: "executionStatus", label: "Tiến độ", type: "text", icon: "Aa", width: 150, permission, readOnly: true, capabilities: read },
  { key: "executionVersion", label: "Phiên bản tiến độ", type: "number", icon: "#", width: 150, permission, readOnly: true, capabilities: read },
  { key: "context", label: "Bối cảnh", type: "text", icon: "Aa", width: 200, permission, readOnly: true, capabilities: read },
  { key: "center", label: "Cơ sở (nội bộ)", type: "text", icon: "Aa", width: 180, permission, readOnly: true, capabilities: { display: false, search: false, filter: false, sort: false, group: false, inlineEdit: false } },
  { key: "assignedAt", label: "Ngày giao", type: "datetime", icon: "▦", width: 200, permission, readOnly: true, capabilities: read },
  { key: "cancelledAt", label: "Ngày hủy", type: "datetime", icon: "▦", width: 200, permission, readOnly: true, capabilities: read },
  { key: "cancelledReason", label: "Lý do hủy", type: "text", icon: "Aa", width: 200, permission, readOnly: true, capabilities: read },
  // PAP-1792 S0-R3: explicitly Founder-approved optional audit columns (PAP-1798 source pending).
  { key: "createdAt", label: "Created Time", type: "text", icon: "Aa", width: 175, permission, readOnly: true, capabilities: { display:true, search:false, filter:false, sort:false, group:false, inlineEdit:false } },
  { key: "createdBy", label: "Created By", type: "text", icon: "Aa", width: 170, permission, readOnly: true, capabilities: { display:true, search:false, filter:false, sort:false, group:false, inlineEdit:false } },
  { key: "updatedAt", label: "Last Modified Time", type: "text", icon: "Aa", width: 175, permission, readOnly: true, capabilities: { display:true, search:false, filter:false, sort:false, group:false, inlineEdit:false } },
  { key: "updatedBy", label: "Last Modified By", type: "text", icon: "Aa", width: 170, permission, readOnly: true, capabilities: { display:true, search:false, filter:false, sort:false, group:false, inlineEdit:false } },
] as const satisfies readonly FieldSchema[];
type F = typeof assignmentFields;
export const assignmentQuery: TableQuery<F> = {
  search: "", filters: { logic: "AND", rules: [] }, sort: { field: "assignedAt", direction: "desc" }, group: null,
  order: assignmentFields.filter(f => f.capabilities.display).map(f => f.key), visible: ["name", "code", "student", "status", "executionStatus", "context", "assignedAt"], page: 1, pageSize: 15,
};
export const assignmentDefinition = {
  version: 1, classification: "TDD_DEFAULT", surface: "BO", key: "missions", label: "Nhiệm vụ", group: "SCHOOL",
  fields: assignmentFields, capabilities: { read: permission, history: permission,
    edit: "student.mission_assignment.manage" },
  actions: [
    { id: "assignment-open-reopen", label: "Mở lại nhiệm vụ", slot: "detail.header", variant: "secondary", capability: "edit", handler: "openReopen" },
    { id: "assignment-cancel-reopen", label: "Quay lại", slot: "drawer.footer", formMode: "edit", variant: "secondary", capability: "edit", handler: "cancelReopen" },
    { id: "assignment-confirm-reopen", label: "Xác nhận mở lại", slot: "drawer.footer", formMode: "edit", variant: "primary", capability: "edit", handler: "confirmReopen" },
  ],
  table: {
    identity: { field: "name", pinned: "left", hideable: false, reorderable: false },
    columns: assignmentFields.filter(f => f.capabilities.display).map(f => ({ field: f.key, visible: assignmentQuery.visible.includes(f.key) })),
    search: { fields: ["name", "code", "student", "context"], normalization: "vi-diacritic-insensitive" },
    filters: { fields: ["status", "executionStatus", "student", "code"], mode: "flat", logic: "AND" },
    sort: { fields: ["name", "code", "student", "status", "executionStatus", "assignedAt"], mode: "single", nulls: "last", tieBreak: "record-id" },
    group: { fields: ["status", "student"], mode: "single" },
    views: { builtIn: [
      { id: "assigned", label: "Đang giao", state: { ...assignmentQuery, filters: { logic: "AND", rules: [{ field: "status", op: "eq", value: "Đang giao" }] } } },
      { id: "in-progress", label: "Đang thực hiện", state: { ...assignmentQuery, filters: { logic: "AND", rules: [{ field: "executionStatus", op: "eq", value: "Đang thực hiện" }] } } },
      { id: "completed", label: "Hoàn tất", state: { ...assignmentQuery, filters: { logic: "AND", rules: [{ field: "executionStatus", op: "eq", value: "Hoàn tất" }] } } },
      { id: "cancelled", label: "Đã hủy", state: { ...assignmentQuery, filters: { logic: "AND", rules: [{ field: "status", op: "eq", value: "Đã hủy" }] } } },
    ], saved: { kind: "local-ui" }, actions: ["add", "apply", "rename", "delete", "reorder"] },
    pagination: { sizes: [8, 15, 30], defaultSize: 15, mode: "local-ui" },
    inlineEdit: { fields: [], enabled: false },
    interaction: { settings: ["properties", "grouping", "filters", "quick-views"], quickView: "separate-opener", keyboard: "canonical", undo: "local-ui-only" },
  },
  drawer: { density: "one-column", sections: [{ id: "summary", label: "Nhiệm vụ được giao", fields: ["student", "name", "code", "status", "executionStatus", "assignedAt", "context", "createdAt", "createdBy", "updatedAt", "updatedBy"] }], actions: [] },
  detail: {
    overview: { sections: [{ id: "assignment", label: "Nhiệm vụ được giao", fields: ["student", "name", "code", "status", "executionStatus", "executionVersion", "assignedAt", "context", "cancelledAt", "cancelledReason", "createdAt", "createdBy", "updatedAt", "updatedBy"] }] },
    businessTabs: [
      { id: "results", label: "Kết quả", kind: "relation-grid", relatedModule: "student-mission-results", source: { adapter: "mission-results-unavailable", permission } },
      { id: "diary", label: "Nhật Ký", kind: "relation-grid", relatedModule: "assignment-diaries", source: { adapter: "assignment-linked-diaries", permission } },
    ],
    history: { kind: "unavailable", reason: "Chưa có nguồn lịch sử được cấp quyền cho Nhiệm vụ này. Không tạo nhật ký thay thế." },
  },
} as const satisfies SurfaceDefinition<F>;
/** PAP-1792 / PAP-1676: independent C1 execution is never Assignment lifecycle. */
function project(p: MissionAssignment, execution: BoMissionExecution | null, names: ReadonlyMap<string,string>): ModuleRow<F> {
  if (p.status === "ASSIGNED" &&
      (!execution || execution.centerId !== p.centerId || execution.assignmentId !== p.id ||
       execution.assignmentStatus !== p.status))
    throw Error("C1 execution/Assignment provenance mismatch");
  return { id: p.id, name: p.missionNameSnapshot, code: p.missionCodeSnapshot, student: names.get(p.studentId) ?? "—",
    status: p.status === "ASSIGNED" ? "Đang giao" : "Đã hủy",
    executionStatus: p.status !== "ASSIGNED" ? null :
      execution!.executionStatus === "COMPLETED" ? "Hoàn tất" : "Đang thực hiện",
    executionVersion: p.status !== "ASSIGNED" ? null : execution!.executionVersion,
    context: p.contextLabel, assignedAt: p.assignedAt, center: p.centerId, cancelledAt: p.cancelledAt ?? "—", cancelledReason: p.cancelledReason,
    // PAP-1792 S0-R3: explicit Founder-approved missing-source glyph; null renders "Trống" in shared TDD.
    createdAt: "—", createdBy: "—", updatedAt: formatMissionAuditTime(p.updatedAt), updatedBy: "—" };
}
export const assignmentProvider: SurfaceProvider<F> = {
  pagination: "local-ui",
  async list(_query, scope, fetcher, signal) {
    if (scope.surface !== "BO") throw Error("BO Center scope required");
    const rows = await readMissionAssignments(fetcher, scope.centerId, signal);
    // The authorized, Center-scoped directory can be unavailable independently.
    // Fall back to an explicit missing-name glyph; never print studentId.
    const names = await readAuthorizedMissionStudentNames(fetcher, scope.centerId, signal)
      .catch(() => { signal.throwIfAborted(); return new Map<string,string>(); });
    // FE-first: at most four concurrent Center-authenticated C1 reads.
    // Unavailable Core truth must fail closed; never synthesize progression.
    const records: { row: ModuleRow<F>; centerId: string; version: string }[] = new Array(rows.length);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(4, rows.length) }, async () => {
      while (next < rows.length) {
        signal.throwIfAborted();
        const i = next++;
        const p = rows[i]!;
        const execution = p.status === "ASSIGNED"
          ? await readBoMissionExecution(fetcher, scope.centerId, p.id, signal) : null;
        records[i] = { row: project(p, execution, names), centerId: p.centerId, version: String(p.version) };
      }
    }));
    return { records, total: rows.length };
  },
  async detail(id, scope, fetcher, signal) {
    if (scope.surface !== "BO") throw Error("BO Center scope required");
    const p = await readMissionAssignment(fetcher, scope.centerId, id, signal);
    if (!p) return null;
    const names = await readAuthorizedMissionStudentNames(fetcher, scope.centerId, signal)
      .catch(() => { signal.throwIfAborted(); return new Map<string,string>(); });
    const execution = p.status === "ASSIGNED"
      ? await readBoMissionExecution(fetcher, scope.centerId, p.id, signal) : null;
    return { row: project(p, execution, names), centerId: p.centerId, version: String(p.version) };
  },
  history: { subjectType: "student_mission_assignment", bind: (fetcher, scope) => ({
    kind: "provider", source: { adapter: "core-center-mission-assignment-history", permission },
    load: (subject, context, cursor, signal) => {
      if (scope.surface !== "BO" || context.surface !== "BO" || context.centerId !== scope.centerId ||
          subject.type !== "student_mission_assignment") return Promise.resolve({ status: "denied" as const });
      const path = "/api/bo/learning/mission-assignments/" + encodeURIComponent(subject.id) +
        "/history?" + new URLSearchParams({ centerId: scope.centerId });
      return readMissionHistory(fetcher, path, subject, cursor, signal);
    },
  }) },
};
const missionRegistry = new TddRegistry();
export const assignmentSchema = missionRegistry.register({ ...assignmentDefinition, data: {
  id: "bo-mission-assignment-center-bound",
  list: async () => { throw Error("Requires authenticated Center-scoped TDD adapter"); },
  detail: async () => { throw Error("Requires authenticated Center-scoped TDD adapter"); },
} });
