/**
 * PAP-1488 / Epic PAP-1188 / PLT-TOS-MISSION-ASSIGN.
 * Pure READ projection only; no UI activation, Diary linkage or completion state.
 */
import type {
  TosMissionAssignmentRecord,
  TosMissionAssignmentScope,
} from "./tos-mission-assignment-api";
import type { TosEligibleMissionChoice } from "./tos-mission-assignment-choices";

export type TosMissionAssignmentCard = Readonly<
  Pick<TosMissionAssignmentRecord,
    "missionId" | "missionCodeSnapshot" | "missionNameSnapshot" |
    "status" | "version" | "contextLabel"> & {
    assignmentId: TosMissionAssignmentRecord["id"];
    catalogLevel: TosEligibleMissionChoice["level"] | null;
  }
>;

export type TosMissionAssignmentCardGroup = Readonly<{
  centerId: string;
  studentId: string;
  teachingContextKey: string;
  cards: readonly TosMissionAssignmentCard[];
}>;

export type TosMissionAssignmentCardModel =
  | { state: "READY"; groups: readonly TosMissionAssignmentCardGroup[] }
  | { state: "EMPTY"; groups: readonly [] }
  | { state: "UNAVAILABLE"; groups: readonly []; reason:
      "INVALID_SCOPE" | "INCOMPLETE_READ" | "INVALID_RECORD" | "DUPLICATE_ID" | "INVALID_CATALOG" };

export type TosMissionAssignmentCardReadOptions = {
  includeCancelled?: boolean;
  /** Caller evidence that ALL requested list pages were read, not just one page. */
  pagination?: { complete: boolean };
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validId = (value: unknown): value is string => typeof value === "string" && uuid.test(value);
const text = (value: unknown): value is string => typeof value === "string" && !!value.trim();
const unavailable = (
  reason: Extract<TosMissionAssignmentCardModel, { state: "UNAVAILABLE" }>["reason"],
): TosMissionAssignmentCardModel => ({ state: "UNAVAILABLE", groups: [], reason });

/**
 * Input must already be bound to the exact occurrence (Core list may be wider).
 * Never silently discard foreign records or publish a partial group. Omitted
 * pagination evidence permits only a short batch, matching the existing reader.
 * Catalog absence never removes an assignment or substitutes current names for
 * persisted snapshots. This projection does not grant read or mutation authority.
 */
export function buildTosMissionAssignmentCardModel(
  scope: TosMissionAssignmentScope,
  records: readonly TosMissionAssignmentRecord[] | null,
  eligibleCatalog?: readonly TosEligibleMissionChoice[],
  options: TosMissionAssignmentCardReadOptions = {},
): TosMissionAssignmentCardModel {
  if (!scope || ![scope.centerId, scope.studentId, scope.runningClassId].every(validId) ||
    typeof scope.localDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(scope.localDate) ||
    !Number.isFinite(Date.parse(scope.localDate + "T12:00:00Z")) ||
    new Date(scope.localDate + "T12:00:00Z").toISOString().slice(0, 10) !== scope.localDate ||
    scope.teachingContextKey !== scope.runningClassId + ":" + scope.localDate) {
    return unavailable("INVALID_SCOPE");
  }
  if (!Array.isArray(records) ||
    (options.pagination !== undefined && options.pagination.complete !== true) ||
    (options.pagination === undefined && records.length >= 100)) {
    return unavailable("INCOMPLETE_READ");
  }

  const seen = new Set<string>();
  for (const row of records) {
    if (!row || !validId(row.id) || !validId(row.missionId) ||
      row.centerId !== scope.centerId || row.studentId !== scope.studentId ||
      row.contextKey !== scope.teachingContextKey ||
      (row.status !== "ASSIGNED" && row.status !== "CANCELLED") ||
      !Number.isSafeInteger(row.version) || row.version < 1 ||
      !text(row.missionCodeSnapshot) || !text(row.missionNameSnapshot) ||
      (row.contextLabel !== null && typeof row.contextLabel !== "string")) {
      return unavailable("INVALID_RECORD");
    }
    // UUID casing must not let the same immutable identity appear twice.
    const key = row.id.toLowerCase();
    if (seen.has(key)) return unavailable("DUPLICATE_ID");
    seen.add(key);
  }

  const catalog = new Map<string, TosEligibleMissionChoice>();
  if (eligibleCatalog !== undefined) {
    if (!Array.isArray(eligibleCatalog)) return unavailable("INVALID_CATALOG");
    for (const choice of eligibleCatalog) {
      if (!choice || !validId(choice.missionId) || !text(choice.code) || !text(choice.name) ||
        !Number.isSafeInteger(choice.level) || choice.level < 1 ||
        (choice.assignmentId !== null && !validId(choice.assignmentId)) ||
        catalog.has(choice.missionId.toLowerCase())) return unavailable("INVALID_CATALOG");
      catalog.set(choice.missionId.toLowerCase(), choice);
    }
  }

  const cards: TosMissionAssignmentCard[] = [];
  for (const row of records) {
    const choice = catalog.get(row.missionId.toLowerCase());
    if (row.status === "ASSIGNED" && choice?.assignmentId != null &&
      choice.assignmentId.toLowerCase() !== row.id.toLowerCase()) {
      return unavailable("INVALID_CATALOG");
    }
    if (row.status === "CANCELLED" && !options.includeCancelled) continue;
    cards.push({
      assignmentId: row.id,
      missionId: row.missionId,
      missionCodeSnapshot: row.missionCodeSnapshot,
      missionNameSnapshot: row.missionNameSnapshot,
      status: row.status,
      version: row.version,
      contextLabel: row.contextLabel,
      catalogLevel: choice?.level ?? null,
    });
  }
  return cards.length === 0 ? { state: "EMPTY", groups: [] } : {
    state: "READY",
    groups: [{ centerId: scope.centerId, studentId: scope.studentId,
      teachingContextKey: scope.teachingContextKey, cards }],
  };
}
