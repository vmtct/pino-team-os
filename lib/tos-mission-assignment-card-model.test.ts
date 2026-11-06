import test from "node:test";
import assert from "node:assert/strict";
import type { TosMissionAssignmentRecord, TosMissionAssignmentScope } from "./tos-mission-assignment-api";
import type { TosEligibleMissionChoice } from "./tos-mission-assignment-choices";
import { buildTosMissionAssignmentCardModel as build } from "./tos-mission-assignment-card-model";

const scope: TosMissionAssignmentScope = {
  centerId: "11111111-1111-4111-8111-111111111111",
  studentId: "22222222-2222-4222-8222-222222222222",
  runningClassId: "33333333-3333-4333-8333-333333333333",
  localDate: "2026-11-05",
  teachingContextKey: "33333333-3333-4333-8333-333333333333:2026-11-05",
};
const otherId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
function record(patch: Partial<TosMissionAssignmentRecord> = {}): TosMissionAssignmentRecord {
  return {
    id: "55555555-5555-4555-8555-555555555555", centerId: scope.centerId,
    studentId: scope.studentId, missionId: "44444444-4444-4444-8444-444444444444",
    missionCodeSnapshot: "ART-101", missionNameSnapshot: "Original name",
    contextKey: scope.teachingContextKey, contextLabel: "Source context", status: "ASSIGNED",
    assignedAt: "2026-11-05T10:00:00Z", assignedByUserId: otherId,
    updatedAt: "2026-11-05T10:00:00Z", updatedByUserId: otherId,
    cancelledAt: null, cancelledReason: null, version: 1, ...patch,
  };
}
function choice(patch: Partial<TosEligibleMissionChoice> = {}): TosEligibleMissionChoice {
  return { missionId: record().missionId, code: "CURRENT", name: "Renamed catalog entry",
    level: 2, assignmentId: record().id, ...patch };
}

test("projects only explicit source fields; catalog cannot replace identity or snapshots", () => {
  const row = Object.freeze({ ...record(), diaryId: "legacy", completed: true });
  const catalog = Object.freeze([Object.freeze(choice())]);
  const result = build(Object.freeze(scope), Object.freeze([row]), catalog);
  assert.deepEqual(result, { state: "READY", groups: [{ centerId: scope.centerId,
    studentId: scope.studentId, teachingContextKey: scope.teachingContextKey, cards: [{
      assignmentId: row.id, missionId: row.missionId,
      missionCodeSnapshot: "ART-101", missionNameSnapshot: "Original name",
      status: "ASSIGNED", version: 1, contextLabel: "Source context", catalogLevel: 2,
    }] }] });
  assert.equal(build(scope, [row]).state, "READY");
  assert.deepEqual(build(scope, [row], []), build(scope, [row]));
});

test("empty and unavailable are distinct, with no partial cards on incomplete reads", () => {
  assert.deepEqual(build(scope, []), { state: "EMPTY", groups: [] });
  for (const rows of [null, [], [record()]]) {
    assert.deepEqual(build(scope, rows, undefined, { pagination: { complete: false } }),
      { state: "UNAVAILABLE", groups: [], reason: "INCOMPLETE_READ" });
  }
  assert.equal(build(scope, null).state, "UNAVAILABLE");
  const rows = Array.from({ length: 100 }, (_, i) => record({
    id: String(i).padStart(8, "0") + "-5555-4555-8555-555555555555",
  }));
  assert.equal(build(scope, rows).state, "UNAVAILABLE");
  assert.equal(build(scope, rows, undefined, { pagination: { complete: true } }).state, "READY");
});

test("rejects foreign Center, Student and teaching context without leaking a partial group", () => {
  for (const patch of [{ centerId: otherId }, { studentId: otherId },
    { contextKey: scope.runningClassId + ":2026-11-04" }]) {
    assert.deepEqual(build(scope, [record(), record({ id: otherId, ...patch })]),
      { state: "UNAVAILABLE", groups: [], reason: "INVALID_RECORD" });
  }
  for (const patch of [{ centerId: "invalid" }, { studentId: " " },
    { runningClassId: otherId }, { localDate: "2026-02-30" }, { teachingContextKey: "legacy" }]) {
    assert.deepEqual(build({ ...scope, ...patch }, []),
      { state: "UNAVAILABLE", groups: [], reason: "INVALID_SCOPE" });
  }
});

test("rejects malformed IDs, snapshots, status, context label and non-positive integer versions", () => {
  const patches: Partial<TosMissionAssignmentRecord>[] = [
    { id: "diary-id" }, { missionId: "mission-code" }, { missionCodeSnapshot: " " },
    { missionNameSnapshot: "" }, { status: "COMPLETED" as TosMissionAssignmentRecord["status"] },
    { contextLabel: undefined }, ...[0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]
      .map(version => ({ version })),
  ];
  for (const patch of patches) assert.equal(build(scope, [record(patch)]).state, "UNAVAILABLE");
});

test("duplicate immutable IDs are rejected even across status, mission and UUID casing", () => {
  for (const duplicate of [record(), record({ missionId: otherId }),
    record({ status: "CANCELLED", version: 2 })]) {
    assert.deepEqual(build(scope, [record(), duplicate]),
      { state: "UNAVAILABLE", groups: [], reason: "DUPLICATE_ID" });
  }
  assert.equal(build(scope, [record({ id: otherId }), record({ id: otherId.toUpperCase() })]).state,
    "UNAVAILABLE");
  // Same Mission with a distinct persisted Assignment is not a duplicate ID.
  assert.equal(build(scope, [record(), record({ id: otherId })]).state, "READY");
});

test("CANCELLED is optional read history, never completion or an active card", () => {
  const cancelled = record({ id: otherId, status: "CANCELLED", version: 2,
    cancelledAt: "2026-11-05T11:00:00Z", cancelledReason: "Replaced" });
  assert.deepEqual(build(scope, [cancelled]), { state: "EMPTY", groups: [] });
  const result = build(scope, [record(), cancelled], undefined, { includeCancelled: true });
  assert.equal(result.state, "READY");
  if (result.state === "READY") {
    assert.deepEqual(result.groups[0]?.cards.map(card => card.status), ["ASSIGNED", "CANCELLED"]);
    assert.equal(result.groups[0]?.cards[1]?.version, 2);
  }
  assert.equal(build(scope, [record({ ...cancelled, version: 0 })]).state, "UNAVAILABLE");
});

test("catalog is optional enrichment, cannot manufacture cards and rejects inconsistent identity", () => {
  assert.deepEqual(build(scope, [], [choice()]), { state: "EMPTY", groups: [] });
  for (const catalog of [[choice({ assignmentId: otherId })], [choice(), choice()],
    [choice({ missionId: "bad" })], [choice({ assignmentId: "diary-id" })],
    [choice({ level: 0 })]]) {
    assert.deepEqual(build(scope, [record()], catalog),
      { state: "UNAVAILABLE", groups: [], reason: "INVALID_CATALOG" });
  }
  const row = record();
  const result = build(scope, [row], [choice({ missionId: otherId, assignmentId: null })]);
  assert.equal(result.state, "READY");
  if (result.state === "READY") assert.equal(result.groups[0]?.cards[0]?.catalogLevel, null);
});
