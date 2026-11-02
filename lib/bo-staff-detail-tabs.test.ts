import assert from "node:assert/strict";
import test from "node:test";
import { resolveStaffDetailTab, staffDetailTabHref, STAFF_DETAIL_TABS } from "./bo-staff-detail-tabs";

test("Staff V2 tab contract preserves all eight approved tabs", () => {
  assert.deepEqual(STAFF_DETAIL_TABS.map((item) => item.key), [
    "overview", "profile", "assignments", "training", "income", "access", "pinoria", "audit",
  ]);
});
test("unknown / forged tab cannot drive arbitrary workspace content", () => {
  assert.equal(resolveStaffDetailTab(null), "overview");
  assert.equal(resolveStaffDetailTab("salary-admin"), "overview");
  assert.equal(resolveStaffDetailTab("access"), "access");
});
test("navigation survives reload/back and preserves safe existing query context", () => {
  const pathname = "/bo/staff/staff-1";
  const target = staffDetailTabHref(pathname, "search=abc&page=2&tab=profile", "access");
  assert.equal(target, "/bo/staff/staff-1?search=abc&page=2&tab=access");
  assert.equal(staffDetailTabHref(pathname, "tab=access", "overview"), pathname);
  assert.equal(resolveStaffDetailTab(new URL(target, "https://example.test").searchParams.get("tab")), "access");
});
