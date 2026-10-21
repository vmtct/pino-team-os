/** Filter an already ACL-scoped Center/TermWeek projection by canonical Staff ID. */
export function filterWorkforceStaff<T extends { id: string }>(staff: readonly T[], requestedStaffId: string): T[] {
  return requestedStaffId ? staff.filter((item) => item.id === requestedStaffId) : [...staff];
}
