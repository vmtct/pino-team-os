/** PAP-1488 / PAP-1188 MISSION / PLT-TOS-MISSION-ASSIGN.
 * Read-only composition of a fresh authenticated V18b day and persisted Assignments.
 * No presentation DTO roster, Diary, catalog fallback or mutation authority.
 */
import { tosClassroomV18bApi, type V18bClassroomToday } from "./tos-classroom-v18b-api";
import { tosMissionAssignmentApi, TosMissionAssignmentApiError } from "./tos-mission-assignment-api";
import { readMissionAssignmentCardsForCandidate } from "./tos-mission-assignment-card-reader";
import type { TosMissionAssignmentCard } from "./tos-mission-assignment-card-model";

export type MissionTabScope = {
  centerId: string;
  localDate: string;
  runningClassId: string;
  teachingContextKey: string;
};
export type MissionTabGroup = {
  studentId: string;
  studentName: string;
  cards: readonly TosMissionAssignmentCard[];
};
export type MissionTabReadState =
  | { state: "LOADING"; groups: readonly [] }
  | { state: "READY" | "EMPTY"; groups: readonly MissionTabGroup[] }
  | { state: "UNAVAILABLE"; groups: readonly []; error: unknown };
type Dependencies = {
  today: (centerId: string, localDate: string) => Promise<V18bClassroomToday>;
  assignments: Parameters<typeof readMissionAssignmentCardsForCandidate>[3];
};
const live: Dependencies = { today: tosClassroomV18bApi.today, assignments: tosMissionAssignmentApi };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (): never => {
  throw new TosMissionAssignmentApiError(502, "MISSION_TAB_SOURCE_UNAVAILABLE",
    "Không thể tải nhiệm vụ đúng phạm vi lớp học.");
};

export async function readMissionAssignmentTab(
  scope: MissionTabScope, api: Dependencies = live, isCurrent: () => boolean = () => true,
): Promise<Extract<MissionTabReadState, { state: "READY" | "EMPTY" }>> {
  if (![scope.centerId, scope.runningClassId].every(id => uuid.test(id)) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(scope.localDate) ||
      !Number.isFinite(Date.parse(scope.localDate + "T12:00:00Z")) ||
      new Date(scope.localDate + "T12:00:00Z").toISOString().slice(0, 10) !== scope.localDate ||
      scope.teachingContextKey !== scope.runningClassId + ":" + scope.localDate) return fail();
  const day = await api.today(scope.centerId, scope.localDate);
  if (!isCurrent()) return fail();
  if (!day || day.centerId !== scope.centerId || day.localDate !== scope.localDate ||
      !Array.isArray(day.occurrences)) return fail();
  const matches = day.occurrences.filter(row => row.teachingContextKey === scope.teachingContextKey);
  if (matches.length !== 1) return fail();
  const occurrence = matches[0]!;
  if (occurrence.runningClassId !== scope.runningClassId ||
      occurrence.teachingContextKey !== scope.runningClassId + ":" + scope.localDate ||
      occurrence.occurrence?.localDate !== scope.localDate ||
      occurrence.occurrence?.status !== "PROJECTED" ||
      !uuid.test(occurrence.occurrence.pathProgramId) || !Array.isArray(occurrence.roster)) return fail();
  const candidates = occurrence.roster.filter(row => row.status === "CANDIDATE");
  if (new Set(occurrence.roster.map(row => row.studentProfileId)).size !== occurrence.roster.length ||
      candidates.some(row => typeof row.studentDisplayName !== "string" || !row.studentDisplayName.trim())) return fail();
  // Publish only the complete read. An ACL/error in any student read hides all cards.
  const groups = await Promise.all(candidates.map(async student => {
    const model = await readMissionAssignmentCardsForCandidate(
      day, occurrence, student.studentProfileId, api.assignments,
    );
    if (model.state === "UNAVAILABLE") return fail();
    return { studentId: student.studentProfileId, studentName: student.studentDisplayName,
      cards: model.groups.flatMap(group => group.cards) };
  }));
  const populated = groups.filter(group => group.cards.length > 0);
  if (!isCurrent()) return fail();
  return { state: populated.length ? "READY" : "EMPTY", groups: populated };
}

/** Effect lifetime owns publication; late successes AND failures are ignored after cleanup. */
export function startMissionAssignmentTabRead(
  scope: MissionTabScope, publish: (state: MissionTabReadState) => void, api: Dependencies = live,
): () => void {
  let active = true;
  publish({ state: "LOADING", groups: [] });
  void readMissionAssignmentTab(scope, api, () => active).then(
    result => { if (active) publish(result); },
    error => { if (active) publish({ state: "UNAVAILABLE", groups: [], error }); },
  );
  return () => { active = false; };
}

/** Never display raw server messages, response bodies or internal error codes. */
export function missionTabReadMessage(error: unknown): string {
  const status = error && typeof error === "object" && "status" in error ? error.status : undefined;
  if (status === 401) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  if (status === 403) return "Bạn chưa có quyền xem nhiệm vụ trong lớp này.";
  return "Chưa tải được nhiệm vụ đã giao. Vui lòng thử lại.";
}
