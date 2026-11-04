import { BoApiError } from "./bo-api-error";
import type { HistoryResult, HistorySubject } from "./workspace-schema";

/** PAP-1207 / PAP-1210, Epic PAP-1188: Core-only, strictly redacted projection. */
export type MissionHistoryKind = "learning_mission" | "student_mission_assignment";
export const missionHistoryId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cursorPattern = /^[A-Za-z0-9_-]{20,2048}$/;
const actionByKind: Record<MissionHistoryKind, readonly string[]> = {
  learning_mission: ["Tạo Mission", "Cập nhật Mission"],
  student_mission_assignment: ["Giao nhiệm vụ", "Cập nhật giao nhiệm vụ", "Hủy giao nhiệm vụ"],
};
const invalid = () => new BoApiError(502, "Lịch sử Mission từ Core không đúng hợp đồng bảo mật.", null);
const object = (v: unknown): v is Record<string, unknown> =>
  Boolean(v && typeof v === "object" && !Array.isArray(v));
const eventKeys = new Set(["id", "occurredAt", "action", "outcome", "actorId", "actorLabel", "before", "after", "description", "redacted"]);

/** Reject the whole response on malformed/unknown/sensitive Core fields; never silently filter. */
export function projectMissionHistoryPage(value: unknown, subject: HistorySubject): HistoryResult {
  if (!object(value) || Object.keys(value).some(k => !["events", "nextCursor"].includes(k)) ||
      !Array.isArray(value.events) || value.events.length > 50 ||
      !(value.nextCursor === null || (typeof value.nextCursor === "string" && cursorPattern.test(value.nextCursor))) ||
      !((subject.type === "learning_mission" || subject.type === "student_mission_assignment") && missionHistoryId.test(subject.id))) throw invalid();
  const allowedActions = actionByKind[subject.type as MissionHistoryKind];
  const ids = new Set<string>();
  let prior: { at: string; id: string } | null = null;
  const events = value.events.map((raw: unknown) => {
    if (!object(raw) || Object.keys(raw).some(k => !eventKeys.has(k)) || Object.keys(raw).length !== eventKeys.size ||
        typeof raw.id !== "string" || !missionHistoryId.test(raw.id) || ids.has(raw.id) ||
        typeof raw.occurredAt !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(raw.occurredAt) || !Number.isFinite(Date.parse(raw.occurredAt)) ||
        typeof raw.action !== "string" || !allowedActions.includes(raw.action) ||
        !["succeeded", "failed", "denied"].includes(String(raw.outcome)) ||
        raw.redacted !== true || raw.actorId !== null || raw.actorLabel !== null ||
        raw.before !== null || raw.after !== null || raw.description !== null) throw invalid();
    if (prior && (raw.occurredAt > prior.at ||
        (raw.occurredAt === prior.at && raw.id >= prior.id))) throw invalid();
    ids.add(raw.id); prior = { at: raw.occurredAt, id: raw.id };
    return {
      id: raw.id as string, at: raw.occurredAt as string, actor: "Đã ẩn",
      action: raw.action as string, outcome: raw.outcome as "succeeded" | "failed" | "denied",
      source: "Core", subject: { type: subject.type, id: subject.id }, redacted: true as const,
    };
  });
  return { status: "authorized", events, nextCursor: value.nextCursor as string | null };
}

/** GET through the current authenticated HO/BO surface transport; no fallback to fixtures. */
export async function readMissionHistory(
  fetcher: typeof fetch, path: string, subject: HistorySubject, cursor: string | null, signal: AbortSignal,
): Promise<HistoryResult> {
  if (!missionHistoryId.test(subject.id) || !actionByKind[subject.type as MissionHistoryKind] ||
      (cursor !== null && !cursorPattern.test(cursor))) throw invalid();
  const url = path + (path.includes("?") ? "&" : "?") +
    new URLSearchParams({ limit: "20", ...(cursor ? { cursor } : {}) });
  const response = await fetcher(url, { method: "GET", cache: "no-store", signal });
  signal.throwIfAborted();
  if (!response.ok) throw new BoApiError(response.status, "Không đọc được lịch sử Mission từ Core.", response.headers.get("x-request-id"));
  const body: unknown = await response.json().catch(() => null);
  signal.throwIfAborted();
  if (!object(body) || Object.keys(body).some(k => k !== "data")) throw invalid();
  return projectMissionHistoryPage(body.data, subject);
}
