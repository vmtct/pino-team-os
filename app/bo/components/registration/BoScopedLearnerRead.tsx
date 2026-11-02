/** PAP-1316 / PAP-1328 — BO Students directory scoped to Core-authorized Active Center.
 * The canonical school adapter retains its normal projection and pagination.
 * All requests are bound at the BFF/Core resource layer, not client-filtered.
 */
const CENTER_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function scopedLearnerFetcher(fetcher: typeof fetch, centerId: string): typeof fetch {
  if (!CENTER_UUID.test(centerId)) throw Error("Cơ sở chưa được xác thực.");
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const original = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(original, "https://bo.invalid");
    // Keep the dedicated Core learner directory contract. Never fetch another
    // domain or fall back to an unscoped Global list on permission denial.
    if (url.origin !== "https://bo.invalid" || url.pathname !== "/api/bo/learners")
      throw Error("Đường đọc học viên ngoài phạm vi cơ sở.");
    const permitted = new Set(["limit", "beforeStudentId", "centerId"]);
    if ([...url.searchParams.keys()].some(key => !permitted.has(key) || url.searchParams.getAll(key).length !== 1))
      throw Error("Truy vấn học viên không hợp lệ.");
    const previous = url.searchParams.get("centerId");
    if (previous !== null && previous !== centerId)
      throw Error("Truy vấn học viên khác cơ sở.");
    url.searchParams.set("centerId", centerId);
    const response = await fetcher(url.pathname + url.search, init);
    if (!response.ok) throw Error("Core từ chối danh bạ học viên trong cơ sở đã chọn.");
    return response;
  }) as typeof fetch;
}
