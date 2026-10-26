export const HO_ALLOWED_READ_PATHS = new Set([
  "centers", "access/users", "access/roles", "access/permissions", "access/audit",
]);
export const hoAccessReadAllowed = (path: string) =>
  HO_ALLOWED_READ_PATHS.has(path) || /^access\/roles\/[0-9a-f-]{36}$/.test(path);

export function validateHoAuditQuery(params: URLSearchParams): void {
  const allowed = new Set(["limit", "offset", "query", "outcome"]);
  for (const key of params.keys()) {
    if (!allowed.has(key) || params.getAll(key).length !== 1) throw new RangeError("Invalid audit filter");
  }
  const limit = params.get("limit");
  const offset = params.get("offset");
  const query = params.get("query");
  const outcome = params.get("outcome");
  if (limit && (!/^\d+$/.test(limit) || +limit < 1 || +limit > 100)) throw new RangeError("Invalid page limit");
  if (offset && (!/^\d+$/.test(offset) || +offset > 1000000)) throw new RangeError("Invalid page offset");
  if (query && query.length > 120) throw new RangeError("Invalid audit query");
  if (outcome && !["succeeded","failed","denied"].includes(outcome)) throw new RangeError("Invalid audit outcome");
}

/** Drop Core's potentially sensitive payload before the HO response enters the browser. */
export function projectHoAuditResponse(body: unknown): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid audit response");
  const data = (body as {data?:unknown}).data;
  const page = (body as {page?:unknown}).page;
  if (!Array.isArray(data) || !page || typeof page !== "object" || Array.isArray(page)) throw new Error("Invalid audit response");
  const keys = ["id","occurredAt","requestId","actorType","actorId","action","subjectType","subjectId","outcome"] as const;
  const rawPage = page as Record<string,unknown>;
  const pageKeys = ["limit","offset","total","page","pageCount"] as const;
  if (pageKeys.some(key => !Number.isSafeInteger(rawPage[key]) || (rawPage[key] as number) < 0) ||
      typeof rawPage.hasPrevious !== "boolean" || typeof rawPage.hasNext !== "boolean") throw new Error("Invalid audit page");
  const safePage = { limit:rawPage.limit,offset:rawPage.offset,total:rawPage.total,page:rawPage.page,pageCount:rawPage.pageCount,hasPrevious:rawPage.hasPrevious,hasNext:rawPage.hasNext };
  return { data: data.map(row => {
    if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error("Invalid audit event");
    const record = row as Record<string,unknown>;
    if (keys.some(key => record[key] !== null && typeof record[key] !== "string")) throw new Error("Invalid audit event");
    return Object.fromEntries(keys.map(key => [key,record[key] ?? null]));
  }), page:safePage };
}
