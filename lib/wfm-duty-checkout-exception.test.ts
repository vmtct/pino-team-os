import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("F4 TOS requests checkout exception with reason only and refetches Core", async () => {
  const [surface, api] = await Promise.all([
    readFile("app/check-in/DutyAwareCheckInOut.tsx", "utf8"),
    readFile("lib/workforce-api.ts", "utf8"),
  ]);
  assert.match(surface, /workforceApi\.requestCheckoutException\(reason\)/);
  assert.match(surface, /Xin ngoại lệ checkout/);
  assert.match(surface, /await load\(\)/);
  assert.doesNotMatch(surface, /localStorage|sessionStorage/);
  assert.match(api, /requestCheckoutException:\(reason:string\)=>request<\{data:StaffDutyCheckoutException\}>\("\/duty\/checkout-exceptions",\{method:"POST",body:JSON\.stringify\(\{reason\}\)\}\)/);
});

test("F4 BO renders canonical list/detail and approves through fresh password only", async () => {
  const source = await readFile("app/bo/workforce/duty-exceptions/DutyExceptionsView.tsx", "utf8");
  assert.match(source, /boApi\.dutyExceptions\(nextCenter\)/);
  assert.match(source, /boApi\.approveDutyException\(selected\.exception\.id, selected\.center\.id, selected\.exception\.version, password\)/);
  assert.match(source, /type="password"/);
  assert.match(source, /Unresolved duties at request/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|rejectDutyException|status:\s*"APPROVED"/);
});

test("F4 BO route stays bounded and navigation exposes the governed workspace", async () => {
  const [route, navigation] = await Promise.all([
    readFile("app/api/bo/[...path]/route.ts", "utf8"),
    readFile("app/bo/navigation.ts", "utf8"),
  ]);
  assert.match(route, /isBoWorkforceDutyExceptionPath\(joined\).*handleBoWorkforceDutyExceptionRequest/);
  assert.match(navigation, /\/bo\/workforce\/duty-exceptions/);
  assert.match(navigation, /Duty Exceptions/);
});
