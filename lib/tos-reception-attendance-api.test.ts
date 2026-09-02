import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { canSettleFromRosterSource, tosReceptionAttendanceApi } from "./tos-reception-attendance-api";
import { TOS_PINORIA_FOOTER } from "../app/components/tos-shell/navigation";

test("Reception Attendance keeps Visit and Attendance on separate Pinoria surfaces", () => {
  const arrival = readFileSync(resolve(process.cwd(), "app/pinoria/arrival-desk.tsx"), "utf8");
  const attendance = readFileSync(resolve(process.cwd(), "app/pinoria/attendance/attendance-desk.tsx"), "utf8");
  assert.equal(arrival.includes("participation/settle"), false);
  assert.equal(arrival.includes("TOS_PINORIA_FOOTER"), true);
  assert.deepEqual(TOS_PINORIA_FOOTER.map((item) => item.href), ["/pinoria", "/pinoria/attendance"]);
  assert.equal(attendance.includes("Hiện diện House ≠ Điểm danh lớp"), true);
  for (const visitMutation of ["visits/open", "check-out", "pinoria/learners/search"]) assert.equal(attendance.includes(visitMutation), false, visitMutation);
  assert.equal(attendance.includes("tosReceptionAttendanceApi.settle"), true);
});

test("Reception auto-settlement allows only roster sources whose full authority shape is projected", () => {
  const source = (basis: string, sourceType = "BOOKING") => ({ basis, sourceId: "source-id", sourceType }) as never;
  for (const basis of ["RECURRING", "EXPLORE", "MAKE_UP", "PAID_EXTRA", "CAMPAIGN_EVENT", "RENEWAL_GRACE"]) {
    assert.equal(canSettleFromRosterSource(source(basis, basis === "RECURRING" ? "ENROLLMENT" : basis === "RENEWAL_GRACE" ? "RENEWAL_GRACE" : "BOOKING")), true);
  }
  for (const basis of ["AUTHORIZED_EXCEPTION", "OCCURRENCE_SWAP", "ADVANCE_UNIT"]) {
    assert.equal(canSettleFromRosterSource(source(basis)), false);
  }
});

test("Reception settlement sends a dedicated idempotency key and never supplies Learning Owner authority", async () => {
  const calls: Array<[string, RequestInit]> = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push([String(url), init ?? {}]);
    return Response.json({ data: { ok: true } });
  }) as typeof fetch;
  try {
    await tosReceptionAttendanceApi.settle({
      studentProfileId: "student-1",
      sessionId: "session-1",
      source: { basis: "RECURRING", sourceId: "enrollment-1", sourceType: "ENROLLMENT" },
      attendanceStatus: "PRESENT",
      recordedAt: "2026-08-28T07:00:00.000Z",
      syllabusId: "syllabus-1",
    }, "attendance-key");
  } finally {
    globalThis.fetch = original;
  }
  const [url, init] = calls[0]!;
  assert.equal(url, "/api/tos-learning/participation/settle");
  assert.equal(new Headers(init.headers).get("idempotency-key"), "attendance-key");
  const body = JSON.parse(String(init.body));
  assert.equal(body.enrollmentId, "enrollment-1");
  assert.deepEqual(body.diary, { syllabusId: "syllabus-1" });
  assert.equal("learningOwnerStaffId" in body.diary, false);
});
