import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { closeoutGuidanceState } from "./wfm-duty-closeout-ui";
import type { StaffDutyBoard, StaffDutyObligation } from "./workforce-api";

const duty: StaffDutyObligation = {
  obligationId: "diary-1",
  action: "TIMED_MILESTONE",
  kind: "SUBMISSION",
  timekeepingSessionId: "tk-1",
  type: "CLASSROOM_DIARY_COMPLETION",
  sourceDomain: "LEARNING",
  sourceRef: "session:session-1:diary",
  status: "PENDING",
  blocking: false,
  requiredBy: "LEARNING_OWNER",
};
const base: StaffDutyBoard = {
  staffMemberId: "staff-1", centerId: "center-1", workDate: "2026-09-05",
  briefing: null, acknowledgement: null, checkoutException: null,
  gate: { action: "CHECK_OUT", mode: "ADVISORY", allowed: true, obligations: [duty], blockers: [], unavailableSources: [] },
  duties: [duty],
};

test("F3 closeout stays closed while any source-owned duty is unresolved", () => {
  assert.equal(closeoutGuidanceState(base).ready, false);
  const resolved = { ...duty, status: "SATISFIED" as const };
  assert.deepEqual(closeoutGuidanceState({ ...base, duties: [resolved], gate: { ...base.gate, obligations: [resolved] } }), {
    ready: true, ambiguous: false, outstanding: [], approvedException: false,
  });
});

test("F3 fails closed for unavailable or ambiguous CHECK_OUT truth", () => {
  assert.equal(closeoutGuidanceState(null).ready, false);
  const unavailable = { ...base, gate: { ...base.gate, unavailableSources: ["LEARNING"], blockers: [{ code: "SOURCE_UNAVAILABLE", sourceDomain: "LEARNING" }] } };
  assert.equal(closeoutGuidanceState(unavailable).ready, false);
  assert.equal(closeoutGuidanceState(unavailable).ambiguous, true);
});

test("F4 approved checkout exception permits checkout guidance without resolving source duties", () => {
  const approved = {
    ...base,
    checkoutException: {
      id: "exc-1", timekeepingSessionId: "tk-1", staffMemberId: "staff-1", centerId: "center-1",
      reason: "Governed handoff", obligationRefs: ["LEARNING::CLASSROOM_DIARY_COMPLETION::session:session-1:diary"],
      obligationSetHash: "a".repeat(64), status: "APPROVED" as const,
      requestedAt: "2026-09-05T12:00:00.000Z", requestedByUserId: "staff-user-1",
      approvedAt: "2026-09-05T12:05:00.000Z", approvedByUserId: "manager-user-1",
      approvalProofRef: "proof-1", version: 2,
    },
  };
  const state = closeoutGuidanceState(approved);
  assert.equal(state.ready, true);
  assert.equal(state.approvedException, true);
  assert.deepEqual(state.outstanding, [duty]);
});

test("F4 approved exception never overrides ambiguous or unavailable duty truth", () => {
  const approved = {
    ...base,
    checkoutException: {
      id: "exc-1", timekeepingSessionId: "tk-1", staffMemberId: "staff-1", centerId: "center-1",
      reason: "Governed handoff", obligationRefs: ["LEARNING::CLASSROOM_DIARY_COMPLETION::session:session-1:diary"],
      obligationSetHash: "a".repeat(64), status: "APPROVED" as const,
      requestedAt: "2026-09-05T12:00:00.000Z", requestedByUserId: "staff-user-1",
      approvedAt: "2026-09-05T12:05:00.000Z", approvedByUserId: "manager-user-1",
      approvalProofRef: "proof-1", version: 2,
    },
    gate: { ...base.gate, unavailableSources: ["LEARNING"], blockers: [{ code: "SOURCE_UNAVAILABLE", sourceDomain: "LEARNING" }] },
  };
  const state = closeoutGuidanceState(approved);
  assert.equal(state.ready, false);
  assert.equal(state.ambiguous, true);
  assert.equal(state.approvedException, true);
});

test("F3 surface keeps completion in owning domains and checkout in Workforce API", async () => {
  const source = await readFile("app/check-in/DutyAwareCheckInOut.tsx", "utf8");
  assert.match(source, /action: nextCurrent \? "CHECK_OUT" : "CHECK_IN"/);
  assert.match(source, /workforceApi\.checkOut\(idempotencyKey\)/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|status:\s*"SATISFIED"/);
});
