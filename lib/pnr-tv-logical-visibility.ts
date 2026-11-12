/** PAP-1753 / PAP-650 PNR-TV — FE list visibility only.
 * A logical TV is NOT a physical Display. Filtering is NOT API/Viewer authorization.
 */
export type LogicalTvVisibilityScope = "DEFAULT" | "CENTER";
export type LogicalTvListItem = Readonly<{
  tvId: string;
  name: string;
  visibilityScope: LogicalTvVisibilityScope;
  centerIds: readonly string[];
}>;

/** Fail closed unless the active Center ID is present in authenticated Staff context.
 * Do not use URL ?center, display names, browser storage, or physical display scope.
 * The caller must supply only trusted logical-TV projection rows once BE is available.
 */
export function visibleLogicalTvs(
  rows: readonly LogicalTvListItem[],
  activeCenterId: string | null | undefined,
  authorizedCenterIds: readonly string[],
): readonly LogicalTvListItem[] {
  if (!activeCenterId || !authorizedCenterIds.includes(activeCenterId)) return [];
  const seen = new Set<string>();
  return rows.filter(item => {
    if (!item?.tvId?.trim() || !item.name?.trim() || seen.has(item.tvId)) return false;
    if (!Array.isArray(item.centerIds) ||
      (item.visibilityScope !== "CENTER" && item.visibilityScope !== "DEFAULT")) return false;
    if (item.visibilityScope === "CENTER" &&
      !item.centerIds.includes(activeCenterId)) return false;
    seen.add(item.tvId);
    return true;
  });
}
