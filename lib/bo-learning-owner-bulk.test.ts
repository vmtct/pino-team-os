import test from "node:test";
import assert from "node:assert/strict";
import { buildUnassignedOwnerGroups } from "./bo-learning-owner-bulk";
import type { BoSession, BoSessionLearningOwner } from "./bo-model";

function session(id: string, runningClassId: string | null): BoSession {
  return {
    id, runningClassId, pathProgramId: "path-1", syllabusId: "syllabus-1", localDate: "2026-09-07",
    startsAt: `2026-09-07T${id === "s2" ? "19" : "18"}:00:00+07:00`, endsAt: "2026-09-07T20:00:00+07:00",
    bookingOpensAt: "2026-09-01T00:00:00Z", bookingClosesAt: "2026-09-07T00:00:00Z",
    availability: { capacity: 8, remainingSeats: 8, isFull: false }, registrationCount: 0, accessOffers: [], status: "SCHEDULED",
  };
}

const owner = (sessionId: string): BoSessionLearningOwner => ({
  sessionId, staffMemberId: "staff-1", assignedAt: "2026-08-29T00:00:00Z", assignedByUserId: "user-1",
  assignmentSource: "OPERATOR", changeReason: null, updatedAt: "2026-08-29T00:00:00Z", version: 1,
});

test("groups only unassigned Sessions by Running Class", () => {
  const groups = buildUnassignedOwnerGroups([session("s1", "class-a"), session("s2", "class-a"), session("s3", "class-b")], { s2: owner("s2") });
  assert.deepEqual(groups.map((item) => [item.key, item.sessionIds]), [["class:class-a", ["s1"]], ["class:class-b", ["s3"]]]);
});

test("unlinked Sessions stay separate so bulk never joins unrelated occurrences", () => {
  const groups = buildUnassignedOwnerGroups([session("s1", null), session("s2", null)], {});
  assert.deepEqual(groups.map((item) => item.sessionIds), [["s1"], ["s2"]]);
});

test("bulk readiness ignores non-SCHEDULED Sessions", () => {
  const completed = { ...session("s4", "class-a"), status: "COMPLETED" };
  const groups = buildUnassignedOwnerGroups([completed], {});
  assert.deepEqual(groups, []);
});
