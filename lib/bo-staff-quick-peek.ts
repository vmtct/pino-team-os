import type { BoAccessUser, BoStaffRecord } from "./bo-model";

export type StaffQuickPeekFact = { label: string; value: string };
export type StaffQuickPeekModel = {
  displayLabel: string;
  staffId: string;
  facts: readonly StaffQuickPeekFact[];
};

/** Explicit non-sensitive allowlist. Never spread a Staff/Access object into the browse drawer. */
export function buildStaffQuickPeekModel(
  staff: BoStaffRecord | null,
  access: BoAccessUser | null,
  attention: string,
  fallbackStaffId = "",
): StaffQuickPeekModel {
  return {
    displayLabel: staff?.displayLabel ?? "Đang tải Staff...",
    staffId: staff?.id ?? fallbackStaffId,
    facts: [
      { label: "Staff", value: staff?.status ?? "Loading" },
      { label: "Access", value: access?.status ?? "Not provisioned" },
      { label: "Department", value: staff?.department ?? "Chưa phân nhóm" },
      { label: "Role label", value: staff?.roleLabel ?? "Chưa có" },
      { label: "Attention", value: attention },
    ],
  };
}
