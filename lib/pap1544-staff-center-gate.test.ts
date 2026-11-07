import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("PAP-1544 / PAP-1316: Staffs default tabs never call unscoped staff-records", () => {
  const source = readFileSync("app/bo/components/registration/BoRuntimeBoundary.tsx", "utf8");
  const start = source.indexOf("function BoStaffsEntry(");
  const end = source.indexOf("export function BoRuntimeEntry(", start);
  assert.ok(start >= 0 && end > start, "Staffs entrypoint must exist");
  const staff = source.slice(start, end);

  assert.match(staff, /if \(key === "staffs"\) \{/);
  assert.match(staff, /if \(view === "register"\)/);
  assert.match(staff, /return readStaffCenterApplications\(fetcher, selected\)/);
  assert.match(staff, /throw Error\("Danh sách nhân sự theo cơ sở tạm thời chưa khả dụng\."\)/);
  const denied = staff.indexOf("throw Error(");
  const legacy = staff.indexOf("unifiedBoWorkspaceSource.load(key, fetcher, requestedOptions)");
  assert.ok(denied > 0 && legacy > denied, "Staffs must fail closed before any generic reader");
  assert.doesNotMatch(staff, /staffsViewRows\(/);
});
