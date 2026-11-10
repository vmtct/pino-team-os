/** PAP-1814 · Epic PAP-1384 / SCH-PARENTS-GUARDIANS.
 * Native PINO BO DSA fields, independent of the retired TDD registry.
 */
import type { BoField, BoModule } from "@/lib/bo-registration";

export const parentNativeFields: BoField[] = [
  { key: "name", label: "Phụ huynh", icon: "Aa", type: "text", w: 235, readonly: false },
  { key: "maskedContact", label: "Liên hệ (đã che)", icon: "Aa", type: "text", w: 180, readonly: true },
  { key: "studentCount", label: "Số học viên", icon: "#", type: "number", w: 120, readonly: true },
  { key: "centers", label: "Cơ sở", icon: "Aa", type: "text", w: 190, readonly: true },
  { key: "createdAt", label: "Created Time", icon: "▦", type: "text", w: 170, readonly: true },
  { key: "createdBy", label: "Created By", icon: "Aa", type: "text", w: 190, readonly: true },
  { key: "updatedAt", label: "Last Modified Time", icon: "▦", type: "text", w: 170, readonly: true },
  { key: "updatedBy", label: "Last Modified By", icon: "Aa", type: "text", w: 190, readonly: true },
  { key: "id", label: "Parent ID", icon: "#", type: "id", w: 190, readonly: true, defaultVisible: false },
  { key: "attention", label: "Lưu ý", icon: "Aa", type: "text", w: 155, readonly: true, defaultVisible: false },
];
export const parentNativeModule: BoModule = {
  label: "Parents & Guardians", group: "Học viên", fields: parentNativeFields,
};
export const parentNativeCreateSections = [
  { id: "profile", label: "Thông tin chính", fields: ["name", "maskedContact", "studentCount", "centers", "attention"] },
];
export const parentNativeSections = [
  ...parentNativeCreateSections,
  { id: "system", label: "Thông tin hệ thống", fields: ["createdAt", "createdBy", "updatedAt", "updatedBy", "id"], collapsed: true },
];
