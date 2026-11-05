/**
 * PAP-1407 / PAP-220 — explicit Center-bound Staff application queue for BO.
 * Never fall back to the old unscoped Staff directory or GLOBAL intake route.
 */
import type { BoRecord } from "./bo-registration";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROOT = "/api/bo/workforce/staff-center-registration-requests";

type PendingEntry = {
  id: string;
  centerId: string;
  displayLabel: string;
  submittedAt: string;
  version: number;
};

export async function readStaffCenterApplications(
  fetcher: typeof fetch,
  centerId: string,
): Promise<BoRecord[]> {
  if (!UUID.test(centerId)) throw new Error("Chưa chọn cơ sở hợp lệ.");
  const response = await fetcher(ROOT + "?centerId=" + encodeURIComponent(centerId), {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error("Vui lòng đăng nhập lại.");
    if (response.status === 403) throw new Error("Không có quyền xem đơn đăng ký tại cơ sở này.");
    throw new Error("Không thể tải danh sách đăng ký.");
  }
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object" || !("data" in payload)) throw new Error("Phản hồi đăng ký không hợp lệ.");
  const data = payload.data;
  if (!Array.isArray(data) || data.length > 50) throw new Error("Danh sách đăng ký vượt giới hạn.");
  const seen = new Set<string>();
  return data.map((raw: unknown) => {
    if (!raw || typeof raw !== "object") throw new Error("Bản ghi đăng ký không hợp lệ.");
    const entry = raw as Partial<PendingEntry>;
    if (typeof entry.id !== "string" || !UUID.test(entry.id) || entry.centerId !== centerId
      || typeof entry.displayLabel !== "string" || !entry.displayLabel.trim()
      || typeof entry.submittedAt !== "string" || !Number.isFinite(Date.parse(entry.submittedAt))
      || typeof entry.version !== "number" || !Number.isSafeInteger(entry.version) || entry.version < 1 || seen.has(entry.id)) {
      throw new Error("Bản ghi đăng ký không hợp lệ.");
    }
    seen.add(entry.id);
    return {
      id: entry.id,
      name: entry.displayLabel,
      status: "Chờ duyệt",
      submittedAt: entry.submittedAt,
      version: entry.version,
      centerId,
    };
  });
}
