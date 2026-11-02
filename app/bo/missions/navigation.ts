/** URL Center is only a candidate; the authenticated Center list must contain it. */
export function missionCenterFromUrl(centers: readonly { id: string }[], url: URL): string {
  const ids = url.searchParams.getAll("centerId");
  if (ids.length > 1) return "";
  return ids.length ? centers.some(c => c.id === ids[0]) ? ids[0]! : "" : centers.length === 1 ? centers[0]!.id : "";
}
export function missionCenterUrl(url: URL, centerId: string): string {
  const next = new URL(url);
  if (centerId) next.searchParams.set("centerId", centerId); else next.searchParams.delete("centerId");
  next.searchParams.delete("record");
  return next.pathname + next.search + next.hash;
}
