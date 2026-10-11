import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path: string) => readFile(path, "utf8");

test("PAP-389 Access Users reuses shared Data Grid with URL-persisted browse and selection", async () => {
  const source = await read("app/bo/system/users/AccessUsersView.tsx");
  assert.match(source, /useBoDataGridUrlState\(ACCESS_USER_GRID_OPTIONS\)/);
  assert.match(source, /searchParams\.get\("accessUser"\)/);
  assert.match(source, /params\.set\("accessUser", nextId\)/);
  assert.match(source, /router\.push\(href, \{ scroll: false \}\)/);
  assert.match(source, /<BoDataGrid/);
  assert.match(source, /BoDataGridSidePeek/);
  assert.match(source, /Account state/);
  assert.match(source, /Roles \/ scopes/);
  assert.match(source, /Filter Access Users by status/);
  assert.doesNotMatch(source, /className=\{styles\.ownerQueue\}/);
});

test("PAP-389 keeps Access mutation and Founder recovery authority on existing bounded paths", async () => {
  const source = await read("app/bo/system/users/AccessUsersView.tsx");
  assert.match(source, /canManageFounderTarget/);
  assert.match(source, /hasEffectiveFounderAssignment/);
  assert.match(source, /selectedUserId !== actorUserId/);
  assert.match(source, /if \(userId === actorUserId\) return/);
  assert.match(source, /boApi\.assignAccessRole/);
  assert.match(source, /boApi\.removeAccessAssignment/);
  assert.match(source, /boApi\.setAccessUserStatus/);
  assert.match(source, /Core vẫn enforce self\/last-Founder invariants/);
  assert.doesNotMatch(source, /localStorage|sessionStorage/);
});
