import { assignmentUuid } from "./bo-mission-assignments";
import { BoApiError } from "./bo-api-error";

/** PAP-1210: Source-backed options, never free-text canonical IDs.
 * Student directory is Core-filtered by effective authorized Center;
 * MissionDefinition catalog is GLOBAL read-only and ACTIVE-filtered.
 */
export type StudentChoice = Readonly<{ id: string; name: string; status: string }>;
export type MissionChoice = Readonly<{ id: string; name: string; code: string; level: number }>;
export type StudentChoices = Readonly<{ items: readonly StudentChoice[]; refineSearch: boolean }>;
const invalid = () => new BoApiError(502, "Nguồn chọn Nhiệm vụ hoặc học viên không hợp lệ.", null);
async function data(fetcher: typeof fetch, path: string, signal: AbortSignal): Promise<readonly unknown[]> {
  const res = await fetcher("/api/bo/" + path, { method: "GET", cache: "no-store",
    credentials: "same-origin", signal, redirect: "error" });
  signal.throwIfAborted();
  if (!res.ok) throw new BoApiError(res.status, "Không thể đọc nguồn dữ liệu được cấp quyền.", res.headers.get("x-request-id"));
  let body: unknown;
  try { body = await res.json(); } catch { throw invalid(); }
  signal.throwIfAborted();
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      !("data" in body) || !Array.isArray(body.data)) throw invalid();
  return body.data;
}
const object = (o: unknown): Record<string, unknown> => {
  if (!o || typeof o !== "object" || Array.isArray(o)) throw invalid();
  return o as Record<string, unknown>;
};
export async function readCenterStudents(
  fetcher: typeof fetch, centerId: string, query: string, signal: AbortSignal,
): Promise<StudentChoices> {
  if (!assignmentUuid.test(centerId)) throw invalid();
  const q = query.trim();
  if (q.length < 2 || q.length > 100) return { items: [], refineSearch: true };
  const params = new URLSearchParams({ centerId, query: q, limit: "50" });
  const rows = await data(fetcher, "learners?" + params, signal);
  if (rows.length > 50) throw invalid();
  const seen = new Set<string>(), items: StudentChoice[] = [];
  for (const unknown of rows) {
    const row = object(unknown);
    if (typeof row.id !== "string" || !assignmentUuid.test(row.id) ||
        typeof row.displayName !== "string" || !row.displayName.trim() ||
        typeof row.status !== "string" || !row.status.trim() || seen.has(row.id)) throw invalid();
    seen.add(row.id);
    items.push({ id: row.id, name: row.displayName.trim(), status: row.status });
  }
  return { items, refineSearch: rows.length === 50 };
}
export async function readActiveMissionChoices(
  fetcher: typeof fetch, signal: AbortSignal,
): Promise<readonly MissionChoice[]> {
  const seen = new Set<string>(), items: MissionChoice[] = [];
  for (let page = 0; page < 101; page++) {
    const params = new URLSearchParams({ status: "ACTIVE", limit: "100", offset: String(page * 100) });
    const rows = await data(fetcher, "learning/missions?" + params, signal);
    if (rows.length > 100 || items.length + rows.length > 10000) throw invalid();
    for (const unknown of rows) {
      const m = object(unknown);
      if (typeof m.id !== "string" || !assignmentUuid.test(m.id) ||
          typeof m.code !== "string" || !/^[A-Z0-9][A-Z0-9_-]{1,63}$/.test(m.code) ||
          typeof m.name !== "string" || !m.name.trim() || m.name.length > 160 ||
          !Number.isInteger(m.level) || Number(m.level) < 1 || Number(m.level) > 5 ||
          !["ACTIVE", "INACTIVE"].includes(String(m.status)) || seen.has(m.id)) throw invalid();
      seen.add(m.id);
      if (m.status === "ACTIVE") items.push({ id: m.id, code: m.code, name: m.name.trim(), level: Number(m.level) });
    }
    if (rows.length < 100) return items.sort((a, b) => a.code.localeCompare(b.code, "vi"));
  }
  throw invalid();
}
