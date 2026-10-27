/** Pinoria Staff reads are scoped to explicit full-detail Pinoria navigation. */
export function shouldLoadStaffPinoria(detailOnly: boolean, tab: string, staffId: string): boolean {
  return detailOnly && tab === "pinoria" && Boolean(staffId);
}
