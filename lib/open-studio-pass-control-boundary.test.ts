import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Open Studio Pass Control uses only canonical BO facade commands", async () => {
  const [api, view] = await Promise.all([
    readFile("lib/bo-api.ts", "utf8"),
    readFile("app/bo/open-studio/OpenStudioView.tsx", "utf8"),
  ]);
  assert.match(api, /open-studio\/member-centers\/assign/);
  assert.match(api, /open-studio\/member-centers\/reassign/);
  assert.match(api, /open-studio\/passes\/issue-bring-a-friend/);
  assert.match(api, /open-studio\/passes\/\$\{encodeURIComponent\(passId\)\}\/revoke/);
  assert.match(view, /issueOpenStudioBringAFriendPass/);
  assert.match(view, /revokeOpenStudioPass/);
  assert.match(view, /pass\.passClass === "MONTHLY_PATH"/);
});

test("Bring-a-Friend inventory does not invent Guest or Sibling admission", async () => {
  const view = await readFile("app/bo/open-studio/OpenStudioView.tsx", "utf8");
  assert.doesNotMatch(view, /participantMode:\s*["']GUEST["']/);
  assert.doesNotMatch(view, /participantMode:\s*["']SIBLING["']/);
  assert.match(view, /participantMode:\s*["']OWNER["']/);
  assert.match(view, /Bring-a-Friend được quản lý ở Pass inventory/);
});
