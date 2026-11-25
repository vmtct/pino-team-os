// PAP-2353 · HO Manual Staff Creation: feature projection over PAP-2342 shared M1 lifecycle.
import { createPreviewState, reducePreview, readPreviewRecord, type PreviewState } from "@/lib/m1-preview/state";
import type { PreviewFeature, PreviewRecord } from "@/lib/m1-preview/contract";
import type { ManualStaffRow, StaffCenterOption, StaffCreateCommand } from "./manual-create-contract";
export type StaffPreviewRecord = ManualStaffRow & PreviewRecord;
export const staffPreviewCenter: StaffCenterOption = { id: "m1-staff-center", label: "PINO Cần Thơ · M1" };
export const staffPreviewSeed: StaffPreviewRecord = {
  id: "STAFF-MOCK-001", fixture: true, name: "Nhân sự mẫu M1", phone: "0900000001", email: "staff-m1@example.invalid", gender: null, birthDate: null,
  center: staffPreviewCenter.label, status: "Đang làm", role: "Staff", loginEmail: null,
  createdAt: null, createdBy: null, updatedAt: null, updatedBy: null,
};
export const staffPreviewFeature = { feature: "STAFF-MANUAL-CREATE", jiraTask: "PAP-2353", surface: "HO", idPrefix: "STAFF-MOCK-", seed: staffPreviewSeed, operations: ["create"] } as const satisfies PreviewFeature<StaffPreviewRecord>;
export const newStaffPreview = (principalId: string) => createPreviewState(staffPreviewFeature, "HO:" + principalId);
export const readStaffPreview = (state: PreviewState<StaffPreviewRecord>, id: string) => readPreviewRecord(state, id);
// Display only: the shared fixture audit stays null. An em dash denotes an unavailable actor, never an identity.
export const projectStaffPreviewRow = (row: StaffPreviewRecord): ManualStaffRow => ({ ...row, createdBy: "—", updatedBy: "—" });
// Strict projection: credentials never enter the shared state, storage, URL or history.
export function createStaffPreviewRecord(state: PreviewState<StaffPreviewRecord>, command: StaffCreateCommand): PreviewState<StaffPreviewRecord> {
  if (state.records.some(row => row.phone === command.phone || (command.login && row.loginEmail === command.login.email))) throw Error("Duplicate M1 record");
  if (command.centerId !== staffPreviewCenter.id) throw Error("Invalid M1 center");
  return reducePreview(state, { type: "create", record: {
    fixture: true, name: command.name, phone: command.phone, email: command.email, gender: command.gender, birthDate: command.birthDate,
    center: staffPreviewCenter.label, status: "Đang làm", role: "Staff", loginEmail: command.login?.email ?? null,
    createdAt: null, createdBy: null, updatedAt: null, updatedBy: null,
  } });
}
