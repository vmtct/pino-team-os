import { BoApiError } from "./bo-api-error";
import { HO_BILLS_API, billIdPattern, canVoidBill, object, parseBillVoid, parseHoBill, type HoBill } from "./ho-bills-contract";
export async function billRequest(suffix: string, init: RequestInit, fetcher: typeof fetch = fetch): Promise<unknown> {
  const response = await fetcher(HO_BILLS_API + suffix, {...init, credentials:"same-origin", cache:"no-store", redirect:"error"});
  if (!response.ok) throw new BoApiError(response.status,
    response.status === 403 ? "Bạn không có quyền xem hoặc Void Bill." : response.status === 409
      ? "Bill đã thay đổi hoặc không thể Void. Tải lại trước khi tiếp tục." : "Không thể tải Bills (HTTP " + response.status + ").", null);
  if (response.status !== 200) throw new BoApiError(502, "Chưa xác minh kết quả từ Core.", null);
  return object(await response.json())?.data;
}
export async function loadBills(fetcher: typeof fetch, signal: AbortSignal): Promise<HoBill[]> {
  const data = await billRequest("", {method:"GET",signal}, fetcher);
  if (!Array.isArray(data) || data.length > 100) throw new BoApiError(502, "Bills response không hợp lệ.", null);
  const rows = data.map(row => parseHoBill(row));
  if (new Set(rows.map(r => r.bill.id)).size !== rows.length) throw new BoApiError(502, "Bills trùng định danh.", null);
  return rows;
}
export async function loadBill(id: string, fetcher: typeof fetch = fetch, signal?: AbortSignal): Promise<HoBill> {
  if (!billIdPattern.test(id)) throw new BoApiError(404, "Không tìm thấy Bill.", null);
  const bill = parseHoBill(await billRequest("/" + id, {method:"GET",signal}, fetcher), true);
  if (bill.bill.id !== id) throw new BoApiError(502, "Bill identity mismatch.", null);
  return bill;
}
export async function voidBill(bill: HoBill, reason: string, key: string, fetcher: typeof fetch = fetch): Promise<void> {
  const command = parseBillVoid({expectedVersion:bill.bill.version, reason, confirmed:true});
  if (!billIdPattern.test(bill.bill.id) || !canVoidBill(bill) || !command || !/^[A-Za-z0-9_-]{8,120}$/.test(key)) throw new BoApiError(400, "Không thể Void Bill.", null);
  const receipt = parseHoBill(await billRequest("/" + bill.bill.id + "/void", {method:"POST",
    headers:{"content-type":"application/json", "idempotency-key":key}, body:JSON.stringify(command)}, fetcher));
  if (receipt.bill.id !== bill.bill.id || !receipt.bill.voidedAt || receipt.paymentState !== "VOID" || receipt.bill.version !== bill.bill.version + 1)
    throw new BoApiError(502, "Chưa xác minh kết quả Void. Tải lại Bill.", null);
}
