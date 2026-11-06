/**
 * PAP-1488 / Epic PAP-1188 / PLT-TOS-MISSION-ASSIGN.
 * Trusted Core Assignment list -> approved Mission-card read model.
 * This reader is deliberately headless; it never enables a writer or touches Diary.
 */
import type { TosMissionAssignmentScope } from "./tos-mission-assignment-api";
import type { TosEligibleMissionChoice } from "./tos-mission-assignment-choices";
import {
  assignmentScopeForCandidate,
  loadAssignmentsInOccurrence,
  type AssignmentV18bOccurrence,
  type AssignmentV18bToday,
} from "./tos-mission-assignment-workflow";
import {
  buildTosMissionAssignmentCardModel,
  type TosMissionAssignmentCardModel,
} from "./tos-mission-assignment-card-model";

type AssignmentReadApi = Parameters<typeof loadAssignmentsInOccurrence>[0];

/** Optional verified Core catalog enrichment. A failed read must reject, never fake EMPTY. */
export type MissionCardEligibleReader = (
  scope: TosMissionAssignmentScope,
) => Promise<readonly TosEligibleMissionChoice[]>;

/**
 * The caller must supply an occurrence from the actual Core-projected day.
 * Scope/roster admission happens BEFORE any HTTP request.
 *
 * The existing Assignment reader filters to this exact teachingContextKey and
 * rejects the 100-row incomplete-page boundary. Its successful return is the
 * completeness evidence for the pure card projection.
 *
 * Unavailable Core reads (including 401/403), duplicate IDs and incomplete
 * pages are propagated or represented as unavailable; never rendered as empty.
 * No Diary result, assignment create/edit/cancel or optimistic completion occurs.
 */
export async function readMissionAssignmentCardsForCandidate(
  day: AssignmentV18bToday,
  occurrence: AssignmentV18bOccurrence,
  studentId: string,
  api: AssignmentReadApi,
  readEligible?: MissionCardEligibleReader,
): Promise<TosMissionAssignmentCardModel> {
  const scope = assignmentScopeForCandidate(day, occurrence, studentId);
  const records = await loadAssignmentsInOccurrence(api, scope);
  const eligible = readEligible ? await readEligible(scope) : undefined;
  return buildTosMissionAssignmentCardModel(
    scope,
    records,
    eligible,
    { pagination: { complete: true } },
  );
}
