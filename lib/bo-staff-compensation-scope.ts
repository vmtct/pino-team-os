/** UI fail-closed projection: never render a different Staff's compensation payload. */
export function staffCompensationOnly<T extends { staffMemberId: string }>(rows: readonly T[], staffId: string): T[] {
  return rows.filter((row) => row.staffMemberId === staffId);
}
