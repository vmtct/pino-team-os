import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("TOS exception request derives staff/workDate in Core and normal check-in requires canonical assignment", async () => {
  const api = await readFile(new URL("./workforce-api.ts", import.meta.url), "utf8");
  assert.match(api, /requestUnscheduledCheckIn:\(centerId:string,reason:string,idempotencyKey:string\)/);
  assert.match(api, /JSON\.stringify\(\{centerId,reason\}\)/);
  assert.doesNotMatch(api, /requestUnscheduledCheckIn:[^\n]*staffMemberId/);
  assert.doesNotMatch(api, /requestUnscheduledCheckIn:[^\n]*workDate/);
  assert.match(api, /checkIn:\(centerId:string,assignmentId:string\)/);
});

test("TOS exception UI uses canonical status and does not persist authority in browser storage", async () => {
  const source = await readFile(new URL("../app/components/WorkforceWorkspace.tsx", import.meta.url), "utf8");
  assert.match(source, /checkInExceptionStatus\(center\.id\)/);
  assert.match(source, /state\.data\.kind !== "ELIGIBLE_ASSIGNMENT"/);
  assert.match(source, /Bạn chưa có ca làm được phân công cho hôm nay/);
  assert.match(source, /Đang chờ Manager duyệt/);
  assert.doesNotMatch(source, /localStorage|sessionStorage/);
});


test("WFM-EXC UI preserves idempotency evidence across uncertain retries and re-reads canonical manager state", async () => {
  const tos = await readFile(new URL("../app/components/WorkforceWorkspace.tsx", import.meta.url), "utf8");
  const bo = await readFile(new URL("../app/bo/workforce/CheckInExceptionsView.tsx", import.meta.url), "utf8");
  assert.match(tos, /requestAttempt = useRef/);
  assert.match(tos, /requestAttempt\.current\.key/);
  assert.match(tos, /requestAttempt\.current = null/);
  assert.match(bo, /mutationAttempt=useRef/);
  assert.match(bo, /mutationKey\(signature/);
  assert.match(bo, /workforceCheckInException\(requestId\)/);
  assert.match(bo, /canonical\.status===terminal/);
});
