/** PAP-1207: independent Founder HO read before versioned Mission Edit. No mutation. */
import type { MissionInput } from "./command";

export type MissionEditLoad =
  | { readonly state: "ready"; readonly id: string; readonly version: number; readonly data: MissionInput }
  | { readonly state: "denied" | "unavailable"; readonly message: string };
const uuidV7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const optional = (value: unknown, max: number): value is string | null =>
  value === null || (typeof value === "string" && value.length <= max);
export async function loadMissionForEdit(
  id: string, fetcher: typeof fetch = fetch, signal?: AbortSignal,
): Promise<MissionEditLoad> {
  if (!uuidV7.test(id)) return { state: "unavailable", message: "Mission ID không hợp lệ." };
  let response: Response;
  try {
    response = await fetcher("/api/ho/learning/missions/" + id, {
      method: "GET", credentials: "same-origin", cache: "no-store", redirect: "error", signal,
    });
  } catch {
    return { state: "unavailable", message: "Không thể đọc phiên bản Mission từ Core." };
  }
  if ([401, 403, 404].includes(response.status))
    return { state: "denied", message: "Không có quyền hoặc Mission không còn khả dụng." };
  if (!response.ok) return { state: "unavailable", message: "Core chưa sẵn sàng để sửa Mission." };
  let raw: unknown;
  try { const body: unknown = await response.json(); raw = body && typeof body === "object" && "data" in body ? body.data : null; }
  catch { raw = null; }
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    return { state: "unavailable", message: "Core trả về dữ liệu Mission không hợp lệ." };
  const row = raw as Record<string, unknown>;
  if (row.id !== id || !Number.isSafeInteger(row.version) || Number(row.version) < 1 ||
      typeof row.code !== "string" || !/^[a-z0-9][a-z0-9_-]{1,63}$/i.test(row.code) ||
      typeof row.name !== "string" || !row.name.trim() || row.name.length > 160 ||
      !Number.isInteger(row.level) || Number(row.level) < 1 || Number(row.level) > 5 ||
      !Number.isSafeInteger(row.plsValue) || Number(row.plsValue) < 0 ||
      !["ACTIVE", "INACTIVE"].includes(String(row.status)) ||
      !(row.paperSize === null || ["B5", "A4", "A3"].includes(String(row.paperSize))) ||
      !optional(row.description, 4000) || !optional(row.guideline, 8000) ||
      !optional(row.pathProgramId, 36) || !optional(row.pathKeySnapshot, 120) ||
      !optional(row.prerequisiteMissionId, 36) || !optional(row.prerequisiteCodeSnapshot, 120) ||
      (row.pathProgramId !== null && !uuidV7.test(String(row.pathProgramId))) ||
      (row.prerequisiteMissionId !== null && !uuidV7.test(String(row.prerequisiteMissionId))))
    return { state: "unavailable", message: "Mission hoặc version từ Core không hợp lệ." };
  return {
    state: "ready", id, version: Number(row.version),
    data: {
      code: row.code as string, name: row.name as string, level: Number(row.level),
      status: row.status as MissionInput["status"], plsValue: Number(row.plsValue),
      paperSize: row.paperSize as MissionInput["paperSize"],
      description: row.description as string | null, guideline: row.guideline as string | null,
      pathProgramId: row.pathProgramId as string | null,
      pathKeySnapshot: row.pathKeySnapshot as string | null,
      prerequisiteMissionId: row.prerequisiteMissionId as string | null,
      prerequisiteCodeSnapshot: row.prerequisiteCodeSnapshot as string | null,
    },
  };
}