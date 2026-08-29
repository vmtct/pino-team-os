import type { BoSession, BoSessionLearningOwner } from "./bo-model";

export interface BoLearningOwnerBulkGroup {
  key: string;
  runningClassId: string | null;
  pathProgramId: string | null;
  sessionIds: string[];
}
export type BoAttendanceReadinessState = "PRESENT_READY" | "NEEDS_OWNER" | "NEEDS_SYLLABUS" | "OUT_OF_SCOPE";

export function attendanceReadinessState(session: BoSession, owner: BoSessionLearningOwner | null | undefined): BoAttendanceReadinessState {
  if (session.status !== "SCHEDULED") return "OUT_OF_SCOPE";
  if (!session.syllabusId) return "NEEDS_SYLLABUS";
  return owner ? "PRESENT_READY" : "NEEDS_OWNER";
}

export function attendanceReadinessCounts(sessions: BoSession[], owners: Record<string, BoSessionLearningOwner | null>) {
  const states = sessions.map((session) => attendanceReadinessState(session, owners[session.id]));
  return {
    presentReady: states.filter((state) => state === "PRESENT_READY").length,
    needsOwnerOnly: states.filter((state) => state === "NEEDS_OWNER").length,
    needsSyllabus: states.filter((state) => state === "NEEDS_SYLLABUS").length,
  };
}
export function buildUnassignedOwnerGroups(
  sessions: BoSession[],
  owners: Record<string, BoSessionLearningOwner | null>,
): BoLearningOwnerBulkGroup[] {
  const groups = new Map<string, BoLearningOwnerBulkGroup>();
  for (const session of sessions) {
    if (attendanceReadinessState(session, owners[session.id]) !== "NEEDS_OWNER") continue;
    const key = session.runningClassId ? `class:${session.runningClassId}` : `session:${session.id}`;
    const current = groups.get(key) ?? {
      key,
      runningClassId: session.runningClassId,
      pathProgramId: session.pathProgramId,
      sessionIds: [],
    };
    current.sessionIds.push(session.id);
    groups.set(key, current);
  }
  return [...groups.values()];
}
