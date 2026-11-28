/** PAP-2411 — canonical Staff Directory navigation hints, not authorization. */
export const STAFF_DIRECTORY_ROUTE = "/bo/workforce/staffs";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const views = new Set(["all", "active", "deactivated", "register"]);
const tracking = new Set(["utm_source","utm_medium","utm_campaign","utm_term","utm_content"]);
type Query = Readonly<Record<string, string | string[] | undefined>>;
export function canonicalStaffDirectoryRoute(query: Query, legacy = false): string | null {
  if (legacy ? query.module !== "staffs" : query.module !== undefined) return null;
  const out = new URLSearchParams();
  for (const [key,value] of Object.entries(query)) {
    if (value === undefined || (legacy && key === "module") || tracking.has(key)) continue;
    if (typeof value !== "string") return null;
    if (key === "centerId" || key === "record") { if (!uuid.test(value)) return null; }
    else if (key === "view") { if (!views.has(value)) return null; }
    else if (key === "surface") { if (value !== "detail") return null; }
    else return null;
    out.set(key,value);
  }
  if (out.has("surface") && (!out.has("record") || out.get("view") === "register")) return null;
  const ordered = new URLSearchParams();
  for (const key of ["centerId","view","record","surface"]) if (out.has(key)) ordered.set(key,out.get(key)!);
  return STAFF_DIRECTORY_ROUTE + (ordered.size ? "?" + ordered.toString() : "");
}
