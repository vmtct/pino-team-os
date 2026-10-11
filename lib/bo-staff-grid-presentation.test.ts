import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path: string) => readFile(path, "utf8");

test("PAP-388 Staff uses shared Data Grid with URL-persisted filters and detail selection", async () => {
  const view = await read("app/bo/staff/StaffManagementView.tsx");
  assert.match(view, /useBoDataGridUrlState\(STAFF_GRID_OPTIONS\)/);
  assert.match(view, /searchParams\.get\("staff"\)/);
  assert.match(view, /params\.set\("staff", nextId\)/);
  assert.match(view, /router\.push\(href, \{ scroll: false \}\)/);
  assert.match(view, /<BoDataGrid/);
  assert.match(view, /BoDataGridSidePeek/);
  assert.match(view, /Filter Staff by status/);
  assert.match(view, /Filter Staff by access/);
  assert.match(view, /Staff status/);
  assert.match(view, /Roles \/ scopes/);
  assert.match(view, /Attention/);
  assert.doesNotMatch(view, /className=\{styles\.staffDirectory\}/);
});

test("PAP-388 preserves bounded Staff private, Access, support and offboarding authority", async () => {
  const view = await read("app/bo/staff/StaffManagementView.tsx");
  assert.match(view, /createStaffPrivateRevealFence/);
  assert.match(view, /boApi\.staffPrivate\(targetId, privateCenterId \|\| undefined\)/);
  assert.match(view, /Dữ liệu chỉ tải khi bấm Hiện/);
  assert.match(view, /boApi\.resetStaffPassword/);
  assert.match(view, /boApi\.startSupportSession/);
  assert.match(view, /offboardStaff/);
  assert.match(view, /boApi\.assignAccessRole/);
  assert.match(view, /boApi\.removeAccessAssignment/);
  assert.doesNotMatch(view, /governmentId.*gridRows|bank.*gridRows/);
});
