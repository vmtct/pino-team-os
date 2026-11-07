/** UI fence only. Canonical Core remains responsible for Staff support-session permissions. */
export function canOpenStaffSupport(
  permissionKeys: readonly string[],
  staffStatus: string | null,
  accessStatus: string | null,
  reason: string,
): boolean {
  return permissionKeys.includes("access.support.impersonate") &&
    staffStatus === "active" &&
    accessStatus === "active" &&
    reason.trim().length >= 3 &&
    reason.trim().length <= 500;
}
