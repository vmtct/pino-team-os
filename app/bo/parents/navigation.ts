import type { DirectoryCenter } from "../pinoria-avatars/centers";

/** A URL remembers context only; authorized discovery and Core still gate every read. */
export function restoreParentCenter(centers: readonly DirectoryCenter[], url: URL): string {
  const requested = url.searchParams.get("centerId");
  if (requested) return centers.find(center => center.id === requested)?.id ?? "";
  return centers.length === 1 ? centers[0].id : "";
}

export function parentCenterUrl(url: URL, centerId: string): string {
  const next = new URL(url);
  if (centerId) next.searchParams.set("centerId", centerId);
  else next.searchParams.delete("centerId");
  return next.pathname + next.search + next.hash;
}
