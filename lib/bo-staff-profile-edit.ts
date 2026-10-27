import type { BoStaffProfilePatch } from "./bo-model";
const PROFILE_FIELDS = ["displayLabel", "email", "mobile", "department", "roleLabel", "employmentType", "startDate"] as const;

export function staffProfileDraftDirty(original: BoStaffProfilePatch, draft: BoStaffProfilePatch): boolean {
  return PROFILE_FIELDS.some(key => (original[key] ?? "") !== (draft[key] ?? ""));
}

export function staffProfileDraftErrors(draft: BoStaffProfilePatch): string[] {
  const errors: string[] = [];
  const name = (draft.displayLabel ?? "").trim();
  if (!name) errors.push("Tên hiển thị là bắt buộc.");
  if (name.length > 200) errors.push("Tên hiển thị quá dài.");
  const email = (draft.email ?? "").trim();
  if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)) errors.push("Email hồ sơ không hợp lệ.");
  const date = draft.startDate ?? "";
  if (date) {
    const value = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(date + "T00:00:00Z") : null;
    if (!value || !Number.isFinite(value.getTime()) || value.toISOString().slice(0, 10) !== date) errors.push("Ngày bắt đầu không hợp lệ.");
  }
  return errors;
}
