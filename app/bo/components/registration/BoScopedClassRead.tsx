/** PAP-1316 / PAP-1328: Running Class read-only Center boundary.
 * Reuses canonical school adapter projection, without editing its shared legacy source.
 * Core + BO facade enforce authorization. This wrapper blocks the legacy GLOBAL fallback.
 */
const CENTER_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function scopedClassesFetcher(fetcher: typeof fetch, centerId: string): typeof fetch {
  if (!CENTER_UUID.test(centerId)) throw Error("Cơ sở chưa được xác thực.");
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = typeof input === "string" ? input : input instanceof URL ? input.pathname + input.search : input.url;
    // A Core 403 must never trigger the shared legacy adapter's single-Center fallback.
    if (path !== "/api/bo/delivery/bootstrap-state") throw Error("Đường đọc lớp ngoài phạm vi Center.");
    const response = await fetcher(path + "?centerId=" + encodeURIComponent(centerId), init);
    if (!response.ok) throw Error("Core từ chối đọc lớp trong cơ sở đã chọn.");
    let payload: { data?: { runningClasses?: unknown; centers?: unknown } };
    try { payload = await response.clone().json() as typeof payload; }
    catch { throw Error("Phản hồi lớp từ Core không hợp lệ."); }
    const classes = payload.data?.runningClasses;
    const centers = payload.data?.centers;
    if (!Array.isArray(classes) || !Array.isArray(centers)) throw Error("Danh sách lớp không hợp lệ.");
    if (classes.some((row: { centerId?: unknown }) => row?.centerId !== centerId) ||
        centers.some((center: { id?: unknown }) => center?.id !== centerId))
      throw Error("Core trả về dữ liệu khác cơ sở.");
    return response;
  }) as typeof fetch;
}
