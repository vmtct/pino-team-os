import type { FieldSchema, TableQuery } from "@/lib/workspace-schema";
import type { SurfaceDefinition } from "@/lib/workspace-adapters";

export const SELF_DIRECTORY_PERMISSION = "pinoria.avatar.directory.view";
const read = { display: true, search: false, filter: false, sort: false, group: false, inlineEdit: false } as const;
const named = { ...read, search: true };
const filter = { ...read, filter: true };
export const selfFields = [
  { key: "name", label: "Person", type: "text", icon: "Aa", width: 240, permission: SELF_DIRECTORY_PERMISSION, readOnly: true, capabilities: named },
  { key: "roles", label: "Vai trò", type: "text", icon: "Aa", width: 160, permission: SELF_DIRECTORY_PERMISSION, readOnly: true, capabilities: read },
  { key: "avatarStatus", label: "Trạng thái Self", type: "select", icon: "▣", width: 170, permission: SELF_DIRECTORY_PERMISSION, readOnly: true, capabilities: filter,
    options: ["IDENTITY_UNLINKED", "SELF_MISSING", "NEEDS_REPAIR", "NOT_STARTED", "IN_PROGRESS", "READY"] },
  { key: "subjectStatus", label: "Trạng thái hồ sơ", type: "select", icon: "▣", width: 165, permission: SELF_DIRECTORY_PERMISSION, readOnly: true, capabilities: filter,
    options: ["ACTIVE", "INACTIVE", "ARCHIVED", "MIXED"] },
  { key: "rowKey", label: "Mã dòng", type: "text", icon: "#", width: 220, permission: SELF_DIRECTORY_PERMISSION, readOnly: true, capabilities: read },
  { key: "personId", label: "Person ID", type: "text", icon: "#", width: 200, permission: SELF_DIRECTORY_PERMISSION, readOnly: true, capabilities: read },
  { key: "pinoriaSelfId", label: "Self ID", type: "text", icon: "#", width: 200, permission: SELF_DIRECTORY_PERMISSION, readOnly: true, capabilities: read },
  { key: "selfStatus", label: "Self lifecycle", type: "text", icon: "Aa", width: 140, permission: SELF_DIRECTORY_PERMISSION, readOnly: true, capabilities: read },
  { key: "staffMemberId", label: "Staff ID", type: "text", icon: "#", width: 190, permission: SELF_DIRECTORY_PERMISSION, readOnly: true, capabilities: read },
  { key: "studentProfileId", label: "Learner ID", type: "text", icon: "#", width: 190, permission: SELF_DIRECTORY_PERMISSION, readOnly: true, capabilities: read },
  { key: "loadoutVersion", label: "Loadout version", type: "number", icon: "#", width: 130, permission: SELF_DIRECTORY_PERMISSION, readOnly: true, capabilities: read },
  { key: "equippedCount", label: "Đang trang bị", type: "number", icon: "#", width: 130, permission: SELF_DIRECTORY_PERMISSION, readOnly: true, capabilities: read },
] as const satisfies readonly FieldSchema[];
export type SelfFields = typeof selfFields;
export const selfQuery: TableQuery<SelfFields> = {
  search: "", filters: { logic: "AND", rules: [] }, sort: null, group: null,
  order: ["name", "roles", "avatarStatus", "subjectStatus", "rowKey", "personId", "pinoriaSelfId", "selfStatus", "staffMemberId", "studentProfileId", "loadoutVersion", "equippedCount"],
  visible: ["name", "roles", "avatarStatus", "subjectStatus"], page: 1, pageSize: 15,
};
const sections = [
  { id: "identity", label: "Định danh", fields: ["name", "roles", "subjectStatus", "rowKey", "personId", "staffMemberId", "studentProfileId"] },
  { id: "self", label: "Pinoria Self", fields: ["avatarStatus", "pinoriaSelfId", "selfStatus", "loadoutVersion", "equippedCount"] },
] as const;
export const selfDefinition = {
  version: 1, classification: "TDD_DEFAULT", surface: "BO", key: "pinoria-avatars",
  label: "Pinoria Self", group: "PINORIA", fields: selfFields,
  capabilities: { read: SELF_DIRECTORY_PERMISSION },
  table: {
    identity: { field: "name", pinned: "left", hideable: false, reorderable: false },
    columns: selfQuery.order.map(field => ({ field, visible: selfQuery.visible.includes(field as typeof selfQuery.visible[number]) })),
    search: { fields: ["name"], normalization: "vi-diacritic-insensitive" },
    filters: { fields: ["avatarStatus", "subjectStatus"], mode: "flat", logic: "AND" },
    sort: { fields: [], mode: "single", nulls: "last", tieBreak: "record-id" },
    group: { fields: [], mode: "single" },
    views: { builtIn: [], saved: { kind: "local-ui" }, actions: ["add", "apply", "rename", "delete", "reorder"] },
    pagination: { sizes: [8, 15, 30], defaultSize: 15, mode: "server" },
    inlineEdit: { fields: [], enabled: false },
    interaction: { settings: ["properties", "grouping", "filters", "quick-views"], quickView: "separate-opener", keyboard: "canonical", undo: "local-ui-only" },
  },
  drawer: { density: "one-column", sections, actions: [] },
  detail: { overview: { sections }, businessTabs: [], history: { kind: "unavailable", reason: "Core chưa cung cấp lịch sử riêng cho Self Directory." } },
} as const satisfies SurfaceDefinition<SelfFields>;
