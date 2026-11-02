import { TddRegistry, type FieldSchema, type TableQuery } from "@/lib/workspace-schema";
import type { SurfaceDefinition } from "@/lib/workspace-adapters";
import { parentDirectoryProvider } from "./provider";

export const PARENT_VIEW = "identity.parent_directory.view";
const base = { display: true, search: false, filter: false, sort: false, group: false, inlineEdit: false } as const;
const named = { ...base, search: true, sort: true };
const sortable = { ...base, sort: true };
export const parentFields = [
  { key: "name", label: "Phụ huynh", icon: "Aa", width: 235, type: "text", permission: PARENT_VIEW, readOnly: true, capabilities: named },
  { key: "id", label: "Parent ID", icon: "#", width: 160, type: "id", permission: PARENT_VIEW, readOnly: true, capabilities: base },
  { key: "maskedContact", label: "Liên hệ (đã che)", icon: "Aa", width: 180, type: "text", permission: PARENT_VIEW, readOnly: true, capabilities: base, sensitive: true },
  { key: "studentCount", label: "Số học viên", icon: "#", width: 120, type: "number", permission: PARENT_VIEW, readOnly: true, capabilities: sortable },
  { key: "centers", label: "Cơ sở", icon: "Aa", width: 190, type: "text", permission: PARENT_VIEW, readOnly: true, capabilities: base },
  { key: "updatedAt", label: "Cập nhật", icon: "▦", width: 170, type: "datetime", permission: PARENT_VIEW, readOnly: true, capabilities: sortable },
  { key: "attention", label: "Lưu ý", icon: "Aa", width: 155, type: "text", permission: PARENT_VIEW, readOnly: true, capabilities: base },
] as const satisfies readonly FieldSchema[];
export type ParentFields = typeof parentFields;
export const parentQuery: TableQuery<ParentFields> = {
  search: "", filters: { logic: "AND", rules: [] }, sort: null, group: null,
  order: ["name", "id", "maskedContact", "studentCount", "centers", "updatedAt", "attention"],
  visible: ["name", "maskedContact", "studentCount", "centers", "updatedAt"], page: 1, pageSize: 15,
};
const sections = [{ id: "overview", label: "Thông tin chính", fields: parentQuery.order }] as const;
export const parentDefinition = {
  version: 1, classification: "TDD_DEFAULT", surface: "BO", key: "parents",
  label: "Parents & Guardians", group: "SCHOOL", fields: parentFields,
  capabilities: { read: PARENT_VIEW, history: "access.audit.view" },
  table: {
    identity: { field: "name", pinned: "left", hideable: false, reorderable: false },
    columns: parentQuery.order.map(field => ({ field, visible: parentQuery.visible.includes(field as typeof parentQuery.visible[number]) })),
    search: { fields: ["name"], normalization: "vi-diacritic-insensitive" },
    filters: { fields: [], mode: "flat", logic: "AND" },
    sort: { fields: ["name", "studentCount", "updatedAt"], mode: "single", nulls: "last", tieBreak: "record-id" },
    group: { fields: [], mode: "single" },
    views: { builtIn: [], saved: { kind: "local-ui" }, actions: ["add", "apply", "rename", "delete", "reorder"] },
    pagination: { sizes: [8, 15, 30], defaultSize: 15, mode: "local-ui" },
    inlineEdit: { fields: [], enabled: false },
    interaction: { settings: ["properties", "grouping", "filters", "quick-views"], quickView: "separate-opener", keyboard: "canonical", undo: "local-ui-only" },
  },
  drawer: { density: "one-column", sections, actions: [] },
  detail: {
    overview: { sections },
    businessTabs: [
      { id: "students", label: "Học viên", kind: "relation-grid", relatedModule: "students", source: { adapter: "bo-parent-detail", permission: PARENT_VIEW } },
      { id: "contacts", label: "Liên hệ", kind: "data-grid", relatedModule: "parent-contacts", source: { adapter: "bo-parent-detail", permission: PARENT_VIEW } },
    ],
    history: { kind: "unavailable", reason: "Chưa liên kết lịch sử Parent đã được Core cấp quyền." },
  },
} as const satisfies SurfaceDefinition<ParentFields>;
export const parentProvider = parentDirectoryProvider();
const registry = new TddRegistry();
export const parentSchema = registry.register({
  ...parentDefinition,
  data: {
    id: "parent-directory-session-required",
    list: async () => { throw Error("Authenticated Parent Directory adapter required"); },
    detail: async () => { throw Error("Authenticated Parent detail adapter required"); },
  },
});
