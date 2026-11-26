/** PAP-2389 / SCH-PARENTS-GUARDIANS — navigation hints, never authority. */
export const PARENT_ROUTE = "/bo/parents";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const tracking = new Set(["utm_source","utm_medium","utm_campaign","utm_term","utm_content"]);
type Query = Readonly<Record<string,string|string[]|undefined>>;
export function canonicalParentRoute(query: Query, legacy = false): string | null {
  if (legacy ? query.module !== "parents" : query.module !== undefined) return null;
  const out = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || key === "module" && legacy || tracking.has(key)) continue;
    if (legacy && key === "pilot" && value === "tdd") continue;
    if (!["record","centerId"].includes(key) || typeof value !== "string" || !(uuid.test(value)||key==="record"&&/^PARENT-MOCK-[0-9]{3,6}$/.test(value))) return null;
    out.set(key,value);
  }
  const ordered = new URLSearchParams();
  for (const key of ["centerId","record"]) if(out.has(key)) ordered.set(key,out.get(key)!);
  return PARENT_ROUTE + (ordered.size ? "?" + ordered.toString() : "");
}
