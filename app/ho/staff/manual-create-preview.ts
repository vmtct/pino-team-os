// PAP-2353 · HO Manual Staff Creation: isolated fixture; import only via admitted M1 preview.
import type { ManualStaffRow, StaffCenterOption, StaffCreateCommand } from "./manual-create-contract";
export const staffPreviewCenter: StaffCenterOption = { id: "m1-staff-center", label: "PINO Cần Thơ · M1" };
export const staffPreviewSeed: ManualStaffRow = {
  id: "m1-staff-001", name: "Nhân sự mẫu M1", phone: "0900000001", email: null, gender: null, birthDate: null,
  center: staffPreviewCenter.label, status: "Đang làm", role: "Staff", loginEmail: null,
  createdAt: null, createdByUser: null, updatedAt: null, updatedByUser: null,
};
// Strict projection: credential fields never enter a row, storage, URL or history.
export function projectStaffPreviewCreate(command: StaffCreateCommand, id: string, rows: readonly ManualStaffRow[]): ManualStaffRow {
  if (!/^m1-staff-\d+$/.test(id) || rows.some(row => row.id === id || row.phone === command.phone || (command.login && row.loginEmail === command.login.email))) throw Error("Duplicate or invalid M1 record");
  if (command.centerId !== staffPreviewCenter.id) throw Error("Invalid M1 center");
  return { id, name: command.name, phone: command.phone, email: command.email, gender: command.gender, birthDate: command.birthDate,
    center: staffPreviewCenter.label, status: "Đang làm", role: "Staff", loginEmail: command.login?.email ?? null,
    createdAt: null, createdByUser: null, updatedAt: null, updatedByUser: null };
}
