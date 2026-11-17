import type { BoModule, BoField } from "@/lib/bo-registration";

/** PAP-1810 / Epic PAP-1705 PNR-AVATAR-CRUD.
 * Native BO DSA schema. No TDD registry, surface adapter or dynamic schema grant.
 * Five Founder-default columns; four audit columns stay optional in selector.
 */
export const avatarFields: BoField[] = [
  { key: "name", label: "Person / Avatar", type: "text", icon: "Aa", w: 240, readonly: true },
  { key: "roles", label: "Vai trò", type: "text", icon: "Aa", w: 160, readonly: true },
  { key: "avatarLabel", label: "Trạng thái Avatar", type: "text", icon: "Aa", w: 165, readonly: true },
  { key: "ownedCount", label: "Tủ đồ", type: "number", icon: "▤", w: 100, readonly: true },
  { key: "loadoutSummary", label: "Loadout", type: "text", icon: "▤", w: 120, readonly: true },
  { key: "createdAt", label: "Created Time", type: "text", icon: "◷", w: 180, readonly: true, defaultVisible: false },
  { key: "createdBy", label: "Created By", type: "text", icon: "◉", w: 180, readonly: true, defaultVisible: false },
  { key: "updatedAt", label: "Last Modified Time", type: "text", icon: "◷", w: 180, readonly: true, defaultVisible: false },
  { key: "updatedBy", label: "Last Modified By", type: "text", icon: "◉", w: 180, readonly: true, defaultVisible: false },
  { key: "nickname", label: "Nickname Avatar", type: "text", icon: "Aa", w: 180, readonly: true, defaultVisible: false },
  { key: "subjectLabel", label: "Trạng thái hồ sơ", type: "text", icon: "Aa", w: 165, readonly: true, defaultVisible: false },
  { key: "avatarStatus", label: "Mã trạng thái Avatar", type: "select", icon: "▣", w: 170, readonly: true, defaultVisible: false,
    options: ["IDENTITY_UNLINKED", "SELF_MISSING", "NEEDS_REPAIR", "NOT_STARTED", "IN_PROGRESS", "READY"] },
  { key: "subjectStatus", label: "Mã trạng thái hồ sơ", type: "select", icon: "▣", w: 165, readonly: true, defaultVisible: false,
    options: ["ACTIVE", "INACTIVE", "ARCHIVED", "MIXED"] },
  { key: "rowKey", label: "Mã dòng", type: "id", icon: "#", w: 220, readonly: true, defaultVisible: false },
  { key: "personId", label: "Person ID", type: "id", icon: "#", w: 200, readonly: true, defaultVisible: false },
  { key: "pinoriaSelfId", label: "Avatar ID", type: "id", icon: "#", w: 200, readonly: true, defaultVisible: false },
  { key: "selfStatus", label: "Vòng đời Avatar", type: "text", icon: "Aa", w: 140, readonly: true, defaultVisible: false },
  { key: "staffMemberId", label: "Staff ID", type: "id", icon: "#", w: 190, readonly: true, defaultVisible: false },
  { key: "studentProfileId", label: "Learner ID", type: "id", icon: "#", w: 190, readonly: true, defaultVisible: false },
  { key: "loadoutVersion", label: "Loadout version", type: "number", icon: "#", w: 130, readonly: true, defaultVisible: false },
  { key: "equippedCount", label: "Đang trang bị", type: "number", icon: "#", w: 130, readonly: true, defaultVisible: false },
];

export const avatarModule: BoModule = { label: "Pinoria Avatar", group: "PINORIA", fields: avatarFields };
export const avatarSections = [
  { id: "identity", label: "Định danh", fields: ["name", "nickname", "roles", "subjectLabel", "rowKey", "personId", "staffMemberId", "studentProfileId"] },
  { id: "avatar", label: "Pinoria Avatar", fields: ["avatarLabel", "ownedCount", "loadoutSummary", "pinoriaSelfId", "selfStatus", "loadoutVersion", "equippedCount"] },
  { id: "system", label: "Thông tin hệ thống", fields: ["createdAt", "createdBy", "updatedAt", "updatedBy"], collapsed: true },
] as const;
