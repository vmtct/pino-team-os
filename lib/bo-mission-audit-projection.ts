import type { HistoryResult, HistoryEvent } from "./workspace-schema";
import type { BoMissionCompletionEvent } from "./bo-mission-completion-client";
import { assignmentUuid } from "./bo-mission-assignments";
import { formatPinoDateTime } from "./pino-datetime";

/** PAP-1792 / Epic PAP-1676: Core owns actor identity and audit provenance. */
export function formatMissionAuditTime(value: string | null | undefined): string {
  return formatPinoDateTime(value);
}
const label = (v: "IN_PROGRESS" | "COMPLETED") => v === "COMPLETED" ? "Hoàn tất" : "Đang thực hiện";

/** A *separate* Center-bound timeline. Never synthesize an actor's legal name. */
export function projectMissionC1History(
  events: readonly BoMissionCompletionEvent[], centerId: string, assignmentId: string,
): HistoryResult {
  if (!assignmentUuid.test(centerId) || !assignmentUuid.test(assignmentId) ||
      events.some(e => e.centerId !== centerId || e.assignmentId !== assignmentId))
    throw Error("BO Mission C1 History Center/Assignment provenance mismatch");
  const seen = new Set<string>();
  let previous = Number.POSITIVE_INFINITY;
  const records: HistoryEvent[] = events.map(e => {
    if (!assignmentUuid.test(e.id) || !assignmentUuid.test(e.actorUserId) ||
        seen.has(e.id) || !Number.isSafeInteger(e.version) || e.version < 1 ||
        e.version >= previous ||
        !((e.action === "COMPLETE" && e.source === "TOS" &&
           e.statusAfter === "COMPLETED" && e.statusBefore === "IN_PROGRESS") ||
          (e.action === "REOPEN" && e.source === "BO" &&
           e.statusAfter === "IN_PROGRESS" && e.statusBefore === "COMPLETED")) ||
        !Number.isFinite(Date.parse(e.occurredAt)))
      throw Error("BO Mission C1 History invalid event");
    seen.add(e.id); previous = e.version;
    return {
      id: e.id, at: e.occurredAt, action: e.action, actor: "—", outcome: "succeeded",
      source: e.source + " · C1", subject: { type: "student_mission_assignment", id: assignmentId },
      redacted: true,
      changes: [
        { field: "executionStatus", before: label(e.statusBefore), after: label(e.statusAfter) },
        { field: "executionVersion", before: e.version - 1, after: e.version },
        ...(e.reason ? [{ field: "reason", before: null, after: e.reason }] : []),
      ],
    };
  });
  return { status: "authorized", events: records, nextCursor: null };
}
