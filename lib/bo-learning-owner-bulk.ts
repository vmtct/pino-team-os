import type { BoSession, BoSessionLearningOwner } from "./bo-model";

export interface BoLearningOwnerBulkGroup {
  key: string;
  runningClassId: string | null;
  pathProgramId: string | null;
  sessionIds: string[];
}

export function buildUnassignedOwnerGroups(
  sessions: BoSession[],
  owners: Record<string, BoSessionLearningOwner | null>,
): BoLearningOwnerBulkGroup[] {
  const groups = new Map<string, BoLearningOwnerBulkGroup>();
  for (const session of sessions) {
    if (session.status !== "SCHEDULED" || !session.syllabusId || owners[session.id]) continue;
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
