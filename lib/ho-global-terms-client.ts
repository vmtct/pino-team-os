import { BoApiError } from "./bo-api-error";
import { GLOBAL_TERMS_API, object, parseCoreTermDetail, parseCoreTermList, termUuid, type GlobalTerm, type GlobalTermDetail } from "./ho-global-terms-contract";
export async function termRequest(path: string, init: RequestInit, fetcher: typeof fetch = fetch): Promise<unknown> {
  const response = await fetcher(GLOBAL_TERMS_API + path, { ...init, credentials: "same-origin", cache: "no-store", redirect: "error" });
  if (!response.ok) throw new BoApiError(response.status, response.status === 409 ? "Dữ liệu đã thay đổi hoặc đang được tham chiếu. Tải lại trước khi thử lại." : "Không thể truy cập Global Terms (HTTP " + response.status + ").", null);
  const body: unknown = await response.json();
  init.signal?.throwIfAborted();
  return object(body)?.data;
}
/** Revalidate the bounded BFF projection, including under a mock network test. */
export function clientTerm(value: unknown, detail = false): GlobalTerm | GlobalTermDetail {
  const raw = object(value);
  const coreShape = raw ? { ...raw, displayName: raw.name } : null;
  const parsed = detail ? parseCoreTermDetail({ data: coreShape }) : parseCoreTermList({ data: [coreShape] })?.[0];
  if (!parsed) throw new BoApiError(502, "Global Term response không hợp lệ.", null);
  return parsed;
}
export async function loadGlobalTerms(fetcher: typeof fetch, signal: AbortSignal): Promise<GlobalTerm[]> {
  const data = await termRequest("", { method: "GET", signal }, fetcher);
  if (!Array.isArray(data)) throw new BoApiError(502, "Global Terms response không hợp lệ.", null);
  const rows = data.map(t => clientTerm(t) as GlobalTerm);
  if (new Set(rows.map(t => t.id)).size !== rows.length) throw new BoApiError(502, "Global Terms trùng định danh.", null);
  return rows;
}
export async function loadGlobalTerm(id: string, fetcher: typeof fetch, signal: AbortSignal): Promise<GlobalTermDetail> {
  if (!termUuid.test(id)) throw new BoApiError(404, "Không tìm thấy Global Term.", null);
  const term = clientTerm(await termRequest("/" + id, { method: "GET", signal }, fetcher), true) as GlobalTermDetail;
  if (term.id !== id) throw new BoApiError(502, "Global Term identity mismatch.", null);
  return term;
}
