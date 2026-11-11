// PAP-1849 / Epic PAP-1676 MISSION ASSIGNMENT.
// Reuse the existing, authenticated, selected-Center BO learner directory.
// Internal IDs remain for relation identity only; never render ID as a name.
import { collectPagedDirectory } from "./bo-school-students-state";
import { studentCenterApi } from "./bo-student-center-api";
import { assignmentUuid } from "./bo-mission-assignments";

export async function readAuthorizedMissionStudentNames(
  fetcher: typeof fetch, centerId: string, signal: AbortSignal,
): Promise<ReadonlyMap<string, string>> {
  if (!assignmentUuid.test(centerId)) throw Error("Cơ sở chưa được xác thực.");
  const rows = await collectPagedDirectory(
    (beforeStudentId, limit) => studentCenterApi.learners("", limit, beforeStudentId, centerId,
      (input, init) => fetcher(input, { ...init, method: "GET", credentials: "same-origin", redirect: "error", signal })),
    100, 100,
  );
  signal.throwIfAborted();
  const names = new Map<string, string>();
  for (const row of rows) {
    // An invalid record is not permission to guess an identity or display its UUID.
    if (!row || !assignmentUuid.test(row.id)) throw Error("Nguồn tên học viên không hợp lệ.");
    const displayName = typeof row.displayName === "string" ? row.displayName.trim() : "";
    if (displayName) names.set(row.id, displayName);
  }
  return names;
}
