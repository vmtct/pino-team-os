import { TddRegistry, type FieldSchema, type TableQuery } from "@/lib/workspace-schema";
import type { ApprovalVerifier } from "@/lib/workspace-schema/registry";
import { selfDirectoryProvider } from "./provider";
import type { SurfaceDefinition } from "@/lib/workspace-adapters";

export const SELF_DIRECTORY_PERMISSION = "pinoria.avatar.directory.view";
const read = { display: true, search: false, filter: false, sort: false, group: false, inlineEdit: false } as const;
const named = { ...read, search: true };
const filter = { ...read, filter: true };
export const selfFields = [
  { key: "name", label: "Person / Avatar", type: "text", icon: "Aa", width: 240, permission: SELF_DIRECTORY_PERMISSION, readOnly: true, capabilities: named },
  { key: "nickname", label: "Nickname Avatar", type: "text", icon: "Aa", width: 180, permission: SELF_DIRECTORY_PERMISSION, readOnly: true, capabilities: read },
  { key: "createdAt", label: "Created Time", type: "text", icon: "Aa", width: 180, permission: SELF_DIRECTORY_PERMISSION, readOnly: true, capabilities: read },
  { key: "createdBy", label: "Created By", type: "text", icon: "Aa", width: 180, permission: SELF_DIRECTORY_PERMISSION, readOnly: true, capabilities: read },
  { key: "updatedAt", label: "Last Modified Time", type: "text", icon: "Aa", width: 180, permission: SELF_DIRECTORY_PERMISSION, readOnly: true, capabilities: read },
  { key: "updatedBy", label: "Last Modified By", type: "text", icon: "Aa", width: 180, permission: SELF_DIRECTORY_PERMISSION, readOnly: true, capabilities: read },
  { key: "roles", label: "Vai trò", type: "text", icon: "Aa", width: 160, permission: SELF_DIRECTORY_PERMISSION, readOnly: true, capabilities: read },
  // PAP-1779 / PNR-AVATAR-CRUD: Core-owned presentation; raw enums remain filters.
  { key: "avatarLabel", label: "Trạng thái Avatar", type: "text", icon: "Aa", width: 165, permission: SELF_DIRECTORY_PERMISSION, readOnly: true, capabilities: read },
  { key: "ownedCount", label: "Tủ đồ", type: "number", icon: "▤", width: 100, permission: SELF_DIRECTORY_PERMISSION, readOnly: true, capabilities: read },
  { key: "loadoutSummary", label: "Loadout", type: "text", icon: "▤", width: 120, permission: SELF_DIRECTORY_PERMISSION, readOnly: true, capabilities: read },
  { key: "subjectLabel", label: "Trạng thái hồ sơ", type: "text", icon: "Aa", width: 165, permission: SELF_DIRECTORY_PERMISSION, readOnly: true, capabilities: read },
  { key: "avatarStatus", label: "Trạng thái Avatar", type: "select", icon: "▣", width: 170, permission: SELF_DIRECTORY_PERMISSION, readOnly: true, capabilities: filter,
    options: ["IDENTITY_UNLINKED", "SELF_MISSING", "NEEDS_REPAIR", "NOT_STARTED", "IN_PROGRESS", "READY"] },
  { key: "subjectStatus", label: "Trạng thái hồ sơ", type: "select", icon: "▣", width: 165, permission: SELF_DIRECTORY_PERMISSION, readOnly: true, capabilities: filter,
    options: ["ACTIVE", "INACTIVE", "ARCHIVED", "MIXED"] },
  { key: "rowKey", label: "Mã dòng", type: "text", icon: "#", width: 220, permission: SELF_DIRECTORY_PERMISSION, readOnly: true, capabilities: read },
  { key: "personId", label: "Person ID", type: "text", icon: "#", width: 200, permission: SELF_DIRECTORY_PERMISSION, readOnly: true, capabilities: read },
  { key: "pinoriaSelfId", label: "Avatar ID", type: "text", icon: "#", width: 200, permission: SELF_DIRECTORY_PERMISSION, readOnly: true, capabilities: read },
  { key: "selfStatus", label: "Vòng đời Avatar", type: "text", icon: "Aa", width: 140, permission: SELF_DIRECTORY_PERMISSION, readOnly: true, capabilities: read },
  { key: "staffMemberId", label: "Staff ID", type: "text", icon: "#", width: 190, permission: SELF_DIRECTORY_PERMISSION, readOnly: true, capabilities: read },
  { key: "studentProfileId", label: "Learner ID", type: "text", icon: "#", width: 190, permission: SELF_DIRECTORY_PERMISSION, readOnly: true, capabilities: read },
  { key: "loadoutVersion", label: "Loadout version", type: "number", icon: "#", width: 130, permission: SELF_DIRECTORY_PERMISSION, readOnly: true, capabilities: read },
  { key: "equippedCount", label: "Đang trang bị", type: "number", icon: "#", width: 130, permission: SELF_DIRECTORY_PERMISSION, readOnly: true, capabilities: read },
] as const satisfies readonly FieldSchema[];
export type SelfFields = typeof selfFields;
export const selfQuery: TableQuery<SelfFields> = {
  search: "", filters: { logic: "AND", rules: [] }, sort: null, group: null,
  // PAP-1779 / PNR-AVATAR-CRUD: five default, audit quartet selectable OFF.
  order: ["name", "roles", "avatarLabel", "ownedCount", "loadoutSummary", "createdAt", "createdBy", "updatedAt", "updatedBy", "subjectLabel", "avatarStatus", "subjectStatus", "rowKey", "personId", "pinoriaSelfId", "selfStatus", "staffMemberId", "studentProfileId", "loadoutVersion", "equippedCount"],
  visible: ["name", "roles", "avatarLabel", "ownedCount", "loadoutSummary"], page: 1, pageSize: 15,
};
const sections = [
  { id: "identity", label: "Định danh", fields: ["name", "nickname", "roles", "subjectLabel", "rowKey", "personId", "staffMemberId", "studentProfileId"] },
  { id: "self", label: "Pinoria Avatar", fields: ["avatarLabel", "loadoutSummary", "pinoriaSelfId", "selfStatus", "loadoutVersion", "equippedCount"] },
  { id: "system", label: "Thông tin hệ thống", fields: ["createdAt", "createdBy", "updatedAt", "updatedBy"], collapsed: true },
] as const;
export const selfDefinition = {
  version: 1, classification: "TDD_DEFAULT", surface: "BO", key: "pinoria-avatars",
  label: "Pinoria Avatar", group: "PINORIA", fields: selfFields,
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
  detail: { overview: { sections }, businessTabs: [{
      id: "wardrobe", label: "Tủ đồ", kind: "approved-extension",
      source: { adapter: "bo-self-item-ownership", permission: "pinoria.self.item.view" },
      extensionId: "pap1300-bo-self-wardrobe",
      approval: { jira: "PAP-1296", owner: "BO Runtime", designAuthority: "Founder",
        files: ["app/bo/pinoria-avatars/SelfWardrobeDetail.tsx", "app/bo/pinoria-avatars/SelfDirectoryTdd.tsx"],
        tests: ["lib/pap1300-self-wardrobe-ui.test.ts"], reviewBy: "2026-12-01T00:00:00+07:00" },
    }, {
      id: "loadout", label: "Loadout", kind: "approved-extension",
      source: { adapter: "bo-self-loadout", permission: "pinoria.self.loadout.view" },
      extensionId: "pap1356-bo-self-loadout",
      approval: { jira: "PAP-1312", owner: "BO Runtime", designAuthority: "Founder",
        files: ["app/bo/pinoria-avatars/SelfLoadoutDetail.tsx", "app/bo/pinoria-avatars/SelfDirectoryTdd.tsx"],
        tests: ["lib/pap1356-self-loadout-ui.test.ts"], reviewBy: "2026-12-01T00:00:00+07:00" },
    }], history: { kind: "unavailable", reason: "Core chưa cung cấp lịch sử sự kiện sở hữu Item qua BO. Provenance và mốc cấp gần nhất hiển thị trong Tủ đồ." } },
} as const satisfies SurfaceDefinition<SelfFields>;

/** PAP-982: the declared TDD source is never a public/no-session data adapter. */
export const selfProvider = selfDirectoryProvider();
/** Founder-approved i5 S4 Tủ đồ prototype PAP-1296, Jira comment #20634.
 * Presentation admission only; Core independently enforces Center and permission.
 */
export const verifySelfWardrobeApproval: ApprovalVerifier = (approval, scope) =>
  scope.surface === "BO" && scope.key === "pinoria-avatars" &&
  approval.owner === "BO Runtime" && approval.designAuthority === "Founder" &&
  ((scope.extensionId === "pap1300-bo-self-wardrobe" && approval.jira === "PAP-1296" &&
    approval.files.includes("app/bo/pinoria-avatars/SelfWardrobeDetail.tsx") &&
    approval.tests.includes("lib/pap1300-self-wardrobe-ui.test.ts")) ||
   (scope.extensionId === "pap1356-bo-self-loadout" && approval.jira === "PAP-1312" &&
    approval.files.includes("app/bo/pinoria-avatars/SelfLoadoutDetail.tsx") &&
    approval.tests.includes("lib/pap1356-self-loadout-ui.test.ts")));
const registry = new TddRegistry(verifySelfWardrobeApproval);
export const selfSchema = registry.register({
  ...selfDefinition,
  data: {
    id: "pinoria-self-directory-session-required",
    list: async () => { throw Error("BO session and scoped adapter required"); },
    detail: async () => { throw Error("BO session and scoped adapter required"); },
  },
});
