/**
 * PAP-1488 / PAP-1188 MISSION: Staff-only, occurrence-scoped eligible choices.
 * No global BO/HO catalog read, no synthetic Mission options, no writes.
 * The full locked/reason catalog is owned by Specialty/eligibility, not this reader.
 */
import {
  TosMissionAssignmentApiError,
  type TosMissionAssignmentScope,
} from "./tos-mission-assignment-api";

export type TosEligibleMissionChoice = {
  missionId: string;
  code: string;
  name: string;
  level: number;
  assignmentId: string | null;
  // PAP-1529: optional while older Core deployments remain readable; the
  // Assignment selector below requires an explicit complete source verdict.
  assignmentDefinitionEligible?: boolean;
  assignmentDefinitionBlockReason?: "MISSION_INELIGIBLE" | "PREREQUISITE_PROOF_UNAVAILABLE" | null;
};
type EligiblePage = TosMissionAssignmentScope & {
  pathProgramId: string;
  items: TosEligibleMissionChoice[];
  hasMore: boolean;
};
const root = "/api/tos-learning/learning/missions/eligible";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (status: number, code: string, message: string): never =>
  { throw new TosMissionAssignmentApiError(status, code, message); };
function validScope(scope: TosMissionAssignmentScope): void {
  if (!scope || ![scope.centerId, scope.studentId, scope.runningClassId].every(x => typeof x === "string" && uuid.test(x)) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(scope.localDate) ||
      !Number.isFinite(Date.parse(scope.localDate + "T12:00:00Z")) ||
      new Date(scope.localDate + "T12:00:00Z").toISOString().slice(0, 10) !== scope.localDate ||
      scope.teachingContextKey !== scope.runningClassId + ":" + scope.localDate) {
    fail(400, "TOS_ELIGIBLE_MISSION_SCOPE_INVALID", "Ngữ cảnh lớp không hợp lệ.");
  }
}
function validPage(body: unknown, scope: TosMissionAssignmentScope, seen: Set<string>): EligiblePage {
  if (!body || typeof body !== "object" || !("data" in body)) {
    return fail(502, "TOS_ELIGIBLE_MISSION_INVALID_RESPONSE", "Danh sách Mission không hợp lệ.");
  }
  const data = (body as { data: unknown }).data;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return fail(502, "TOS_ELIGIBLE_MISSION_INVALID_RESPONSE", "Danh sách Mission không hợp lệ.");
  }
  const p = data as Record<string, unknown>;
  if (["centerId", "studentId", "runningClassId", "localDate", "teachingContextKey"].some(
      key => p[key] !== scope[key as keyof TosMissionAssignmentScope]) ||
      !uuid.test(String(p.pathProgramId)) || !Array.isArray(p.items) ||
      p.items.length > 100 || typeof p.hasMore !== "boolean" ||
      (p.hasMore && p.items.length !== 100)) {
    return fail(502, "TOS_ELIGIBLE_MISSION_SCOPE_MISMATCH", "Danh sách Mission không khớp học viên và lớp.");
  }
  for (const entry of p.items) {
    if (!entry || typeof entry !== "object" || !uuid.test(entry.missionId) ||
        typeof entry.code !== "string" || !entry.code.trim() ||
        typeof entry.name !== "string" || !entry.name.trim() ||
        !Number.isSafeInteger(entry.level) || entry.level < 1 ||
        (entry.assignmentId !== null && !uuid.test(entry.assignmentId)) ||
        seen.has(entry.missionId)) {
      return fail(502, "TOS_ELIGIBLE_MISSION_INVALID_ITEM", "Mission không hợp lệ hoặc trùng.");
    }
    seen.add(entry.missionId);
  }
  return p as unknown as EligiblePage;
}

/** Fetch all 100-sized pages; abort on incomplete, mismatched or unauthorized data. */
export async function readTosEligibleMissions(
  scope: TosMissionAssignmentScope,
  transport: typeof fetch = (...args) => fetch(...args),
): Promise<readonly TosEligibleMissionChoice[]> {
  validScope(scope);
  const items: TosEligibleMissionChoice[] = [], seen = new Set<string>();
  for (let offset = 0; offset <= 10000; offset += 100) {
    const url = root + "?" + new URLSearchParams({
      centerId: scope.centerId, studentId: scope.studentId,
      runningClassId: scope.runningClassId, localDate: scope.localDate,
      teachingContextKey: scope.teachingContextKey,
      limit: "100", offset: String(offset),
    });
    const response = await transport(url, { method: "GET", cache: "no-store" });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const e = body && typeof body === "object" && "error" in body
        ? (body as { error?: { code?: string; message?: string } }).error : undefined;
      return fail(response.status, e?.code ?? "TOS_ELIGIBLE_MISSION_READ_DENIED",
        e?.message ?? "Không thể tải Mission hợp lệ.");
    }
    const page = validPage(body, scope, seen);
    items.push(...page.items);
    if (!page.hasMore) return items;
  }
  return fail(409, "TOS_ELIGIBLE_MISSION_PAGE_LIMIT", "Danh sách Mission vượt giới hạn tải.");
}

/**
 * PAP-1529 / PAP-1188: a CREATE-definition candidate is not a write grant.
 * Retain all Diary-eligible choices in the original reader; never treat missing
 * metadata or a stale Core deployment as proof of Assignment admissibility.
 * Core must still enforce Staff/Center/roster, version/CAS and duplicate guards.
 */
export function assignmentDefinitionReadyChoices(
  choices: readonly TosEligibleMissionChoice[],
): readonly TosEligibleMissionChoice[] {
  const ready:TosEligibleMissionChoice[]=[];
  for(const choice of choices){
    const allowed=choice.assignmentDefinitionEligible;
    const reason=choice.assignmentDefinitionBlockReason;
    if(typeof allowed!=="boolean" ||
      (allowed && reason!==null) ||
      (!allowed && reason!=="MISSION_INELIGIBLE" && reason!=="PREREQUISITE_PROOF_UNAVAILABLE")){
      return fail(502,"TOS_ASSIGNMENT_DEFINITION_READINESS_UNVERIFIED",
        "Chưa xác nhận được điều kiện giao nhiệm vụ.");
    }
    if(allowed)ready.push(choice);
  }
  return ready;
}
