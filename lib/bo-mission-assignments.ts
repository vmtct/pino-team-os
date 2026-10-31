import { BoApiError } from "./bo-api-error";

/** PAP-1210 consumes PAP-1208. Assignment is independent of Result and Diary. */
export const assignmentUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type MissionAssignment = {
  id: string; centerId: string; studentId: string; missionId: string;
  missionCodeSnapshot: string; missionNameSnapshot: string;
  contextKey: string; contextLabel: string | null; status: "ASSIGNED" | "CANCELLED";
  assignedAt: string; assignedByUserId: string; updatedAt: string; updatedByUserId: string;
  cancelledAt: string | null; cancelledReason: string | null; version: number;
};
const invalid = () => new BoApiError(502, "Phản hồi Nhiệm vụ không hợp lệ hoặc khác Center.", null);
const text = (v: unknown, max: number, empty = false): v is string => typeof v === "string" && (empty || !!v.trim()) && v.length <= max;
const timestamp = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v));
export function parseMissionAssignment(value: unknown, centerId: string, expectedId?: string): MissionAssignment {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
  const p = value as Record<string, unknown>;
  if (!assignmentUuid.test(centerId) || ![p.id, p.centerId, p.studentId, p.missionId, p.assignedByUserId, p.updatedByUserId].every(v => typeof v === "string" && assignmentUuid.test(v)) ||
      p.centerId !== centerId || (expectedId !== undefined && p.id !== expectedId) ||
      !text(p.missionCodeSnapshot, 200) || !text(p.missionNameSnapshot, 500) || !text(p.contextKey, 120, true) ||
      !(p.contextLabel === null || text(p.contextLabel, 200)) || !["ASSIGNED", "CANCELLED"].includes(String(p.status)) ||
      !timestamp(p.assignedAt) || !timestamp(p.updatedAt) || !Number.isSafeInteger(p.version) || Number(p.version) < 1 ||
      !(p.cancelledAt === null || timestamp(p.cancelledAt)) || !(p.cancelledReason === null || text(p.cancelledReason, 500)) ||
      (p.status === "ASSIGNED" ? p.cancelledAt !== null || p.cancelledReason !== null : p.cancelledAt === null || p.cancelledReason === null)) throw invalid();
  // Explicit projection: unexpected/private Core properties never enter the renderer.
  return Object.fromEntries(["id", "centerId", "studentId", "missionId", "missionCodeSnapshot", "missionNameSnapshot", "contextKey", "contextLabel", "status", "assignedAt", "assignedByUserId", "updatedAt", "updatedByUserId", "cancelledAt", "cancelledReason", "version"].map(k => [k, p[k]])) as MissionAssignment;
}
async function read(fetcher: typeof fetch, path: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetcher("/api/bo/learning/mission-assignments" + path, { method: "GET", cache: "no-store", signal });
  signal.throwIfAborted();
  if (!response.ok) throw new BoApiError(response.status, "Không thể đọc Nhiệm vụ tại Center này.", response.headers.get("x-request-id"));
  let body: unknown;
  try { body = await response.json(); } catch { throw invalid(); }
  signal.throwIfAborted();
  if (!body || typeof body !== "object" || !("data" in body)) throw invalid();
  return body.data;
}
/** No total in C1 API: collect complete bounded pages before local TDD search/sort.
 * Exceeding the bound fails visibly; never show a truncated list as a complete count. */
export async function readMissionAssignments(fetcher: typeof fetch, centerId: string, signal: AbortSignal): Promise<readonly MissionAssignment[]> {
  if (!assignmentUuid.test(centerId)) throw invalid();
  const rows: MissionAssignment[] = [], seen = new Set<string>();
  for (let page = 0; page <= 100; page++) {
    const data = await read(fetcher, "?" + new URLSearchParams({ centerId, limit: "100", offset: String(page * 100) }), signal);
    if (!Array.isArray(data) || data.length > 100 || rows.length + data.length > 10000) throw invalid();
    for (const value of data) {
      const row = parseMissionAssignment(value, centerId);
      if (seen.has(row.id)) throw invalid();
      seen.add(row.id); rows.push(row);
    }
    if (data.length < 100) return rows;
  }
  throw invalid();
}
export async function readMissionAssignment(fetcher: typeof fetch, centerId: string, id: string, signal: AbortSignal): Promise<MissionAssignment | null> {
  if (!assignmentUuid.test(centerId) || !assignmentUuid.test(id)) throw invalid();
  try { return parseMissionAssignment(await read(fetcher, "/" + encodeURIComponent(id) + "?" + new URLSearchParams({ centerId }), signal), centerId, id); }
  catch (error) { if (error instanceof BoApiError && error.status === 404) return null; throw error; }
}
