import test from "node:test";
import assert from "node:assert/strict";
import { canSettleSource, tosDayOfLearningApi } from "./tos-day-of-learning-api";

test("Day of Learning settles recurring PRESENT with evidence and replay key", async () => {
  const calls: Array<[string, RequestInit]> = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push([String(url), init ?? {}]);
    return Response.json({ data: { ok: true } });
  }) as typeof fetch;
  try {
    await tosDayOfLearningApi.settle({
      studentProfileId: "student-1", sessionId: "session-1",
      source: { basis: "RECURRING", sourceId: "enrollment-1", sourceType: "ENROLLMENT" },
      attendanceStatus: "PRESENT", syllabusId: "syllabus-1", learningNote: "Nhịp ổn", observation: "Tự tin hơn",
    }, "day-key");
  } finally { globalThis.fetch = original; }
  const [url, init] = calls[0]!;
  assert.equal(url, "/api/tos-learning/participation/settle");
  assert.equal(new Headers(init.headers).get("idempotency-key"), "day-key");
  const body = JSON.parse(String(init.body));
  assert.equal(body.enrollmentId, "enrollment-1");
  assert.deepEqual(body.diary, { syllabusId: "syllabus-1", learningNote: "Nhịp ổn", observation: "Tự tin hơn" });
  assert.equal("learningOwnerStaffId" in body.diary, false);
});

test("Day of Learning keeps Visit separate and forwards optimistic correction versions", async () => {
  const calls: Array<[string, RequestInit]> = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => { calls.push([String(url), init ?? {}]); return Response.json({ data: {} }); }) as typeof fetch;
  try {
    await tosDayOfLearningApi.checkIn("student-1", "center-1", "Day of Learning");
    await tosDayOfLearningApi.correctAttendance({ attendanceId: "attendance-1", attendanceVersion: 2, diaryVersion: 3, nextStatus: "ABSENT", reason: "Operator correction" }, "correct-key");
  } finally { globalThis.fetch = original; }
  assert.equal(calls[0]![0], "/api/tos-learning/students/student-1/visits/open");
  const visitBody = JSON.parse(String(calls[0]![1].body));
  assert.equal(visitBody.centerId, "center-1");
  assert.equal(calls[1]![0], "/api/tos-learning/attendances/attendance-1/correct");
  assert.equal(new Headers(calls[1]![1].headers).get("idempotency-key"), "correct-key");
  assert.deepEqual(JSON.parse(String(calls[1]![1].body)), { status: "ABSENT", expectedAttendanceVersion: 2, reason: "Operator correction", expectedDiaryVersion: 3 });
});

test("Day of Learning only auto-settles roster sources with complete authority shape", () => {
  const source = (basis: string, sourceType = "BOOKING") => ({ basis, sourceId: "source-id", sourceType }) as never;
  for (const basis of ["RECURRING", "EXPLORE", "MAKE_UP", "PAID_EXTRA", "CAMPAIGN_EVENT", "RENEWAL_GRACE"]) {
    assert.equal(canSettleSource(source(basis, basis === "RECURRING" ? "ENROLLMENT" : basis === "RENEWAL_GRACE" ? "RENEWAL_GRACE" : "BOOKING")), true);
  }
  for (const basis of ["AUTHORIZED_EXCEPTION", "OCCURRENCE_SWAP", "ADVANCE_UNIT"]) assert.equal(canSettleSource(source(basis)), false);
});

test("Open Studio Desk uses the bounded day projection and claim outcome command", async () => {
  const calls: Array<[string, RequestInit]> = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => { calls.push([String(url), init ?? {}]); return Response.json({ data: { claims: [] } }); }) as typeof fetch;
  try {
    await tosDayOfLearningApi.openStudioDay("center-1", "2026-08-30");
    await tosDayOfLearningApi.settleOpenStudioOwner({ claimId: "claim-1", attendanceStatus: "PRESENT", syllabusId: "syllabus-1", learningNote: "Ổn định", observation: "Chủ động" }, "claim-key");
  } finally { globalThis.fetch = original; }
  assert.equal(calls[0]![0], "/api/tos-learning/open-studio/day?centerId=center-1&localDate=2026-08-30");
  assert.equal(calls[1]![0], "/api/tos-learning/open-studio/claims/claim-1/outcome");
  assert.equal(new Headers(calls[1]![1].headers).get("idempotency-key"), "claim-key");
  const body = JSON.parse(String(calls[1]![1].body));
  assert.equal(body.attendanceStatus, "PRESENT");
  assert.equal(typeof body.recordedAt, "string");
  assert.deepEqual(body.diary, { syllabusId: "syllabus-1", learningNote: "Ổn định", observation: "Chủ động" });
});