import test from "node:test";
import assert from "node:assert/strict";
import {
  TosMissionAssignmentApiError,
  type TosMissionAssignmentRecord,
  type TosMissionAssignmentScope,
} from "./tos-mission-assignment-api";
import type { TosEligibleMissionChoice } from "./tos-mission-assignment-choices";
import type { AssignmentV18bToday } from "./tos-mission-assignment-workflow";
import { readMissionAssignmentCardsForCandidate as readCards } from "./tos-mission-assignment-card-reader";

const ids = {
  center: "11111111-1111-4111-8111-111111111111",
  student: "22222222-2222-4222-8222-222222222222",
  classId: "33333333-3333-4333-8333-333333333333",
  mission: "44444444-4444-4444-8444-444444444444",
  assignment: "55555555-5555-4555-8555-555555555555",
  other: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
};
const scope: TosMissionAssignmentScope = {
  centerId: ids.center,
  studentId: ids.student,
  runningClassId: ids.classId,
  localDate: "2026-11-06",
  teachingContextKey: ids.classId + ":2026-11-06",
};
const day: AssignmentV18bToday = {
  centerId: ids.center,
  localDate: scope.localDate,
  occurrences: [{
    runningClassId: ids.classId,
    teachingContextKey: scope.teachingContextKey,
    occurrence: {
      localDate: scope.localDate,
      status: "PROJECTED",
      pathProgramId: ids.mission,
    },
    roster: [{ studentProfileId: ids.student, status: "CANDIDATE" }],
  }],
};
function record(patch: Partial<TosMissionAssignmentRecord> = {}): TosMissionAssignmentRecord {
  return {
    id: ids.assignment, centerId: ids.center, studentId: ids.student,
    missionId: ids.mission, missionCodeSnapshot: "ART-101",
    missionNameSnapshot: "Source mission name", contextKey: scope.teachingContextKey,
    contextLabel: "Teacher context", status: "ASSIGNED",
    assignedAt: "2026-11-06T10:00:00Z", assignedByUserId: ids.other,
    updatedAt: "2026-11-06T10:00:00Z", updatedByUserId: ids.other,
    cancelledAt: null, cancelledReason: null, version: 1, ...patch,
  };
}
type ReadApi = Parameters<typeof readCards>[3];
function api(list: ReadApi["list"]): ReadApi {
  const forbidden = async (): Promise<never> => { throw Error("Reader invoked a writer"); };
  return { list, create: forbidden, updateContext: forbidden, cancel: forbidden };
}
const denied = (status: number, code: string) => (error: unknown) =>
  error instanceof TosMissionAssignmentApiError &&
  error.status === status && error.code === code;

test("reads exact authenticated occurrence into source-backed card, no write call", async () => {
  let calls = 0;
  const result = await readCards(day, day.occurrences[0]!, ids.student,
    api(async input => {
      calls++;
      assert.deepEqual(input, { ...scope, status: "ASSIGNED", limit: 100, offset: 0 });
      return [record()];
    }));
  assert.equal(calls, 1);
  assert.deepEqual(result, { state: "READY", groups: [{
    centerId: ids.center, studentId: ids.student, teachingContextKey: scope.teachingContextKey,
    cards: [{
      assignmentId: ids.assignment, missionId: ids.mission,
      missionCodeSnapshot: "ART-101", missionNameSnapshot: "Source mission name",
      status: "ASSIGNED", version: 1, contextLabel: "Teacher context", catalogLevel: null,
    }],
  }] });
});

test("invalid occurrence, missing candidate and CONFLICT deny before network", async () => {
  let reads = 0;
  const reader = api(async () => { reads++; return []; });
  await assert.rejects(readCards(day, { ...day.occurrences[0]! }, ids.student, reader),
    denied(403, "MISSION_ASSIGNMENT_ROSTER_SCOPE_DENIED"));
  await assert.rejects(readCards(day, day.occurrences[0]!, ids.other, reader),
    denied(403, "MISSION_ASSIGNMENT_ROSTER_SCOPE_DENIED"));
  const conflict = structuredClone(day);
  conflict.occurrences[0]!.roster[0]!.status = "CONFLICT";
  await assert.rejects(readCards(conflict, conflict.occurrences[0]!, ids.student, reader),
    denied(403, "MISSION_ASSIGNMENT_ROSTER_SCOPE_DENIED"));
  assert.equal(reads, 0);
});

test("source denial is preserved; never convert 401/403/503 into an empty UI", async () => {
  for (const status of [401, 403, 503]) {
    let catalogReads = 0;
    await assert.rejects(readCards(day, day.occurrences[0]!, ids.student,
      api(async () => { throw new TosMissionAssignmentApiError(status, "SOURCE_DENIED", "denied"); }),
      async () => { catalogReads++; return []; }),
      denied(status, "SOURCE_DENIED"));
    assert.equal(catalogReads, 0);
  }
});

test("catalog errors are propagated, and no stale Assignment card is marked empty", async () => {
  const source = api(async () => [record()]);
  await assert.rejects(readCards(day, day.occurrences[0]!, ids.student, source,
    async () => { throw new TosMissionAssignmentApiError(503, "CATALOG_UNAVAILABLE", "unavailable"); }),
    denied(503, "CATALOG_UNAVAILABLE"));
});

test("other dated occurrence is excluded; zero current assignments is truly EMPTY", async () => {
  const result = await readCards(day, day.occurrences[0]!, ids.student,
    api(async () => [record({ contextKey: ids.classId + ":2026-11-05" })]));
  assert.deepEqual(result, { state: "EMPTY", groups: [] });
});

test("scope mismatch, duplicate IDs and incomplete page reject without publishing cards", async () => {
  for (const [rows, code, status] of [
    [[record(), record({ id: ids.other, centerId: ids.other })],
      "MISSION_ASSIGNMENT_SOURCE_MISMATCH", 502],
    [[record(), record()], "MISSION_ASSIGNMENT_DUPLICATE_ID", 502],
    [Array.from({ length: 100 }, (_, i) => record({
      id: String(i).padStart(8, "0") + "-5555-4555-8555-555555555555",
    })), "MISSION_ASSIGNMENT_PAGE_INCOMPLETE", 409],
  ] as const) {
    await assert.rejects(readCards(day, day.occurrences[0]!, ids.student,
      api(async () => rows as TosMissionAssignmentRecord[])), denied(status, code));
  }
});

test("optional eligible catalog enriches only, never replaces Core persisted snapshots", async () => {
  const choice: TosEligibleMissionChoice = {
    missionId: ids.mission, code: "NEW-CODE", name: "Renamed catalog",
    level: 2, assignmentId: ids.assignment,
  };
  let catalogScope: TosMissionAssignmentScope | undefined;
  const result = await readCards(day, day.occurrences[0]!, ids.student,
    api(async () => [record()]), async current => {
      catalogScope = current;
      return [choice];
    });
  assert.deepEqual(catalogScope, scope);
  assert.equal(result.state, "READY");
  if (result.state === "READY") {
    assert.equal(result.groups[0]?.cards[0]?.missionCodeSnapshot, "ART-101");
    assert.equal(result.groups[0]?.cards[0]?.missionNameSnapshot, "Source mission name");
    assert.equal(result.groups[0]?.cards[0]?.catalogLevel, 2);
  }
  const conflict = await readCards(day, day.occurrences[0]!, ids.student,
    api(async () => [record()]), async () => [{ ...choice, assignmentId: ids.other }]);
  assert.deepEqual(conflict, { state: "UNAVAILABLE", groups: [], reason: "INVALID_CATALOG" });
});
