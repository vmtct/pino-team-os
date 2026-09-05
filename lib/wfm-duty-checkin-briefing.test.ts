import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { briefingCheckInReady, isCurrentBriefingAcknowledged } from "./wfm-duty-briefing-ui";

const briefing = {
  briefingRef: "shift:center:2026-09-05",
  revision: "revision-b",
  staffMemberId: "staff-1",
  centerId: "center-1",
  workDate: "2026-09-05",
  items: [],
};
const acknowledgement = {
  id: "ack-1",
  staffMemberId: "staff-1",
  centerId: "center-1",
  workDate: "2026-09-05",
  briefingRef: briefing.briefingRef,
  briefingRevision: briefing.revision,
  acknowledgedAt: "2026-09-05T10:00:00.000Z",
  actorUserId: "user-1",
};

test("F2 unlocks Check-in only for the exact current briefing revision", () => {
  assert.equal(isCurrentBriefingAcknowledged(briefing, acknowledgement), true);
  assert.equal(isCurrentBriefingAcknowledged(briefing, { ...acknowledgement, briefingRevision: "revision-a" }), false);
  assert.equal(briefingCheckInReady({ boardLoaded: true, briefing, acknowledgement }), true);
  assert.equal(briefingCheckInReady({ boardLoaded: true, briefing, acknowledgement: null }), false);
  assert.equal(briefingCheckInReady({ boardLoaded: false, briefing: null, acknowledgement: null }), false);
  assert.equal(briefingCheckInReady({ boardLoaded: true, briefing: null, acknowledgement: null }), true);
});

test("F2 TOS briefing keeps WFM-TIME as sole mutation authority", async () => {
  const source = await readFile("app/check-in/DutyAwareCheckInOut.tsx", "utf8");
  assert.match(source, /workforceApi\.dutyBoard/);
  assert.match(source, /"CHECK_IN"/);
  assert.match(source, /workforceApi\.acknowledgeDutyBriefing/);
  assert.match(source, /workforceApi\.checkIn\(center\.id, assignment\?\.id \?\? null\)/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|fetch\([^)]*timekeeping/i);
  assert.match(source, /boardLoaded: Boolean\([^)]*board\)/);
});
