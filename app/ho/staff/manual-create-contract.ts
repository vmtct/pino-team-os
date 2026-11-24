// PAP-2353 · HO Manual Staff Creation / PAP-220 · Staff.
// Shared native HO field metadata; no mock data, auth grants or network implementation.
import { staffDefinition, staffFields, staffQuery } from "./schema";
import type { FieldSchema, ModuleRow, TableQuery } from "@/lib/workspace-schema";
import type { SurfaceDefinition } from "@/lib/workspace-adapters/contracts";

const property = { display: true, search: false, filter: false, sort: false, group: false, inlineEdit: false } as const;
const base = { permission: "team.bo.access", readOnly: true, capabilities: property, width: 180 } as const;
export const manualStaffFields = [
  ...staffFields,
  { ...base, key: "phone", label: "Số điện thoại", type: "text", icon: "Aa" },
  { ...base, key: "email", label: "Email", type: "email", icon: "Aa" },
  { ...base, key: "gender", label: "Giới tính", type: "select", icon: "Aa", options: ["Nam", "Nữ", "Khác"] },
  { ...base, key: "birthDate", label: "Sinh Nhật", type: "date", icon: "▦" },
  { ...base, key: "center", label: "Cơ sở", type: "text", icon: "Aa" },
  { ...base, key: "loginEmail", label: "Email đăng nhập", type: "email", icon: "Aa" },
  { ...base, key: "createdAt", label: "Created Time", type: "datetime", icon: "▦" },
  { ...base, key: "createdByUser", label: "Created By", type: "text", icon: "Aa" },
  { ...base, key: "updatedAt", label: "Last Modified Time", type: "datetime", icon: "▦" },
  { ...base, key: "updatedByUser", label: "Last Modified By", type: "text", icon: "Aa" },
] as const satisfies readonly FieldSchema[];
export type ManualStaffFields = typeof manualStaffFields;
export type ManualStaffRow = ModuleRow<ManualStaffFields>;
export const manualStaffSections = [
  { id: "staff-info", label: "Thông tin Staff", fields: ["name", "phone", "email", "gender", "birthDate", "center", "status", "role", "loginEmail"] },
  { id: "audit", label: "Thông tin hệ thống", fields: ["createdAt", "createdByUser", "updatedAt", "updatedByUser"] },
] as const;
export const manualStaffDefinition = {
  ...staffDefinition,
  fields: manualStaffFields,
  drawer: { ...staffDefinition.drawer, sections: manualStaffSections },
  detail: { ...staffDefinition.detail, overview: { sections: manualStaffSections } },
} as const satisfies SurfaceDefinition<ManualStaffFields>;
export const manualStaffQuery: TableQuery<ManualStaffFields> = { ...staffQuery };

export type StaffDraft = { name: string; phone: string; email: string; gender: string; birthDate: string; centerId: string; loginEmail: string };
export type StaffLoginDraft = { password: string; confirmation: string };
export type StaffCenterOption = { id: string; label: string };
export type StaffCreateCommand = {
  name: string; phone: string; email: string | null; gender: string | null; birthDate: string | null; centerId: string;
  login: { email: string; password: string } | null;
};
export const emptyStaffDraft = (): StaffDraft => ({ name: "", phone: "", email: "", gender: "", birthDate: "", centerId: "", loginEmail: "" });
const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export function validateStaffDraft(draft: StaffDraft, centers: readonly StaffCenterOption[], login: StaffLoginDraft | null): { ok: true; command: StaffCreateCommand } | { ok: false; error: string } {
  const name = draft.name.trim(), phone = draft.phone.replace(/[\s().-]/g, "").replace(/^\+84/, "0");
  const email = draft.email.trim(), loginEmail = draft.loginEmail.trim().toLowerCase();
  if (!name || !/^0\d{9}$/.test(phone) || !centers.some(center => center.id === draft.centerId)) return { ok: false, error: "Nhập tên, số điện thoại hợp lệ và chọn cơ sở." };
  if (email && !validEmail(email)) return { ok: false, error: "Email không hợp lệ." };
  if (draft.gender && !["Nam", "Nữ", "Khác"].includes(draft.gender)) return { ok: false, error: "Giới tính không hợp lệ." };
  if (draft.birthDate && (!/^\d{4}-\d{2}-\d{2}$/.test(draft.birthDate) || !Number.isFinite(Date.parse(draft.birthDate)) || new Date(draft.birthDate).toISOString().slice(0, 10) !== draft.birthDate)) return { ok: false, error: "Sinh Nhật không hợp lệ." };
  if (login && (!validEmail(loginEmail) || login.password.length < 10 || login.password.length > 128 || login.password !== login.confirmation)) return { ok: false, error: "Nhập email đăng nhập và mật khẩu 10–128 ký tự khớp nhau." };
  return { ok: true, command: { name, phone, email: email || null, gender: draft.gender || null, birthDate: draft.birthDate || null, centerId: draft.centerId,
    login: login ? { email: loginEmail, password: login.password } : null } };
}
