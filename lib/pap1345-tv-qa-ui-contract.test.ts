import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("PAP-1345: staging-only synthetic Staff HO UX uses existing Founder Core role facade",()=>{
  const ui = readFileSync("app/ho/staff/StaffRoleAccess.tsx","utf8");
  const handler = readFileSync("lib/ho-staff-role-facade.ts","utf8");
  assert.match(ui,/window\.location\.hostname === "ho\.staging\.pinohouse\.art"/);
  assert.match(ui,/staffId === TV_QA_STAFF_ID/);
  assert.match(ui,/qaUser\?\.id === TV_QA_USER_ID/);
  assert.match(ui,/principalId !== TV_QA_USER_ID/);
  assert.match(ui,/role\.permissionKeys\.length !== 1/);
  assert.match(ui,/role\.permissionKeys\[0\] !== "tv\.launch"/);
  assert.match(ui,/writeTvQaStaffCommand\(staffId, \{ action: "remove"/);
  assert.match(ui,/writeTvQaStaffCommand\(staffId, \{\s*action: "assign"/);
  assert.match(ui,/verifyTvQaReadback/);
  assert.doesNotMatch(ui,/window\.localStorage|document\.cookie/);
  assert.match(handler,/authorizeHoShell\(request\.headers, env\)/);
  assert.match(handler,/env\.APP_ENV !== "staging"/);
  assert.match(handler,/callFounderCoreWithStaffPassword/);
  assert.match(handler,/idempotency-key/);
  assert.doesNotMatch(ui,/fetch\(["']\/api\/bo\/access\/assignments/);
});

test("PAP-1345: no legacy BO Access pages or Core migration required",()=>{
  const tests=readFileSync("lib/bo-access-system-contract.test.ts","utf8");
  assert.match(tests,/retir(?:es|ed) standalone Users\/Roles/);
  assert.match(tests,/assert\.doesNotMatch\(source, \/href: "\\\/bo\\\/system\\\/users"/);
});
