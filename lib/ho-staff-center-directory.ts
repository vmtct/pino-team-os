/**
 * PAP-1407 / PAP-220 — Founder HO Staff Links Center directory read.
 * Use the observed, authenticated BO Center directory wire contract.
 * Never infer Center rights or synthesize records when the directory fails.
 */
export interface HoStaffLinkCenter {
  id: string;
  centerKey: string;
  name: string;
}

const CANONICAL_CENTER = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ENDPOINT = "/api/bo/centers";

export async function readHoStaffLinkCenters(
  fetcher: typeof fetch,
  signal?: AbortSignal,
): Promise<HoStaffLinkCenter[]> {
  const response = await fetcher(ENDPOINT, {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
    signal,
  });
  if (!response.ok) {
    throw new Error(response.status === 403 ? "Không có quyền xem cơ sở." : "Không tải được danh sách cơ sở.");
  }
  const body: unknown = await response.json();
  if (!body || typeof body !== "object" || Array.isArray(body) || !("data" in body)) {
    throw new Error("Dữ liệu cơ sở không hợp lệ.");
  }
  const data = body.data;
  if (!Array.isArray(data) || data.length > 500) throw new Error("Dữ liệu cơ sở không hợp lệ.");
  const ids = new Set<string>();
  return data.map((item: unknown): HoStaffLinkCenter => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("Bản ghi cơ sở không hợp lệ.");
    }
    const row = item as Record<string, unknown>;
    const { id, key, displayName } = row;
    if (typeof id !== "string" || !CANONICAL_CENTER.test(id) || ids.has(id)
      || typeof key !== "string" || !key.trim()
      || typeof displayName !== "string" || !displayName.trim()) {
      throw new Error("Bản ghi cơ sở không hợp lệ.");
    }
    ids.add(id);
    return { id, centerKey: key.trim(), name: displayName.trim() };
  });
}
