/** PAP-1316 / PAP-1335 — BO Enrollments use the existing audited Center-scoped
 * BFF projection. No global fallback, no client filtering and no write admission. */
const CENTER_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function scopedEnrollmentFetcher(fetcher: typeof fetch, centerId: string): typeof fetch {
  if (!CENTER_UUID.test(centerId)) throw Error("Cơ sở chưa được xác thực.");
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const original = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(original, "https://bo.invalid");
    if (url.origin !== "https://bo.invalid" || url.pathname !== "/api/bo/school/enrollments")
      throw Error("Đường đọc Enrollment ngoài phạm vi cơ sở.");
    const permitted = new Set(["limit", "beforeCreatedAt", "beforeSubscriptionId", "centerId"]);
    if ([...url.searchParams.keys()].some(key => !permitted.has(key) || url.searchParams.getAll(key).length !== 1))
      throw Error("Truy vấn Enrollment không hợp lệ.");
    const requested = url.searchParams.get("centerId");
    if (requested !== null && requested !== centerId) throw Error("Truy vấn Enrollment khác cơ sở.");
    url.searchParams.set("centerId", centerId);
    const result = await fetcher(url.pathname + url.search, init);
    if (!result.ok) throw Error("Core từ chối danh sách Enrollment trong cơ sở đã chọn.");
    return result;
  }) as typeof fetch;
}
