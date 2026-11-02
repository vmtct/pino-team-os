/** PAP-1316 / PAP-1327. Positively enrolled BO query-module read adapters.
 * Do not add a module until its Core/API CENTER scope and negative ACL tests pass.
 */
export const BO_CENTER_READ_WAVE1 = ["visits", "timekeeping", "classes"] as const;

export function isBoCenterReadWave1(moduleKey: string): boolean {
  return BO_CENTER_READ_WAVE1.some(key => key === moduleKey);
}

/** A scoped URL is only propagated to admitted adapters and only from Core-authorized choice.
 * Never mutate the caller URL or carry an old record, detail hash or TDD state.
 */
export function boCenterWave1Href(
  href: string,
  moduleKey: string,
  selected: string,
  authorizedCenterIds: readonly string[],
): string {
  if (!isBoCenterReadWave1(moduleKey) || !authorizedCenterIds.includes(selected)) return href;
  const next = new URL(href, "https://bo.invalid");
  if (next.pathname !== "/bo" || next.origin !== "https://bo.invalid") return href;
  next.searchParams.delete("record");
  next.searchParams.set("centerId", selected);
  next.hash = "";
  return next.pathname + next.search;
}
