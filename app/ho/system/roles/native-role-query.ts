// PAP-2373 / PLT-ACCESS: pure M4 route contract; not an authorization decision.
// Used by the native page and return-to validation; server authorization remains independent.
const tracking = new Set(["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]);
const readRoleId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseNativeRoleQuery(params: URLSearchParams): { record?: string } | null {
  if ([...params.keys()].some(key => key !== "record" && !tracking.has(key))) return null;
  if (params.getAll("record").length > 1) return null;
  const record = params.get("record");
  if (record === null) return {};
  return readRoleId.test(record) && record.length === 36 ? { record } : null;
}
