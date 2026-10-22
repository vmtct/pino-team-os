/** PAP-924: restrict BO Shared Views routing before any authenticated Core call. */
const MODULE = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,95}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function boPublicViewCoreRoute(path: string, method: string): string | null {
  const parts = path.split("/");
  if (parts[0] !== "views" || !MODULE.test(parts[1] ?? "")) return null;
  if (parts.length === 2 && ["GET", "POST"].includes(method)) return path;
  if (parts.length === 3 && parts[2] === "reorder" && method === "PUT") return path;
  if (parts.length === 3 && UUID.test(parts[2] ?? "") && ["PATCH", "DELETE"].includes(method)) return path;
  if (parts.length === 4 && UUID.test(parts[2] ?? "") && parts[3] === "rename" && method === "PATCH") return path;
  return null;
}