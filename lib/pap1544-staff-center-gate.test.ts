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
  const directory = readFileSync("app/bo/workforce/staffs/StaffDirectoryWorkspace.tsx", "utf8");
  assert.match(staff, /<StaffDirectoryWorkspace[\s\S]*registration=\{<StaffRegistrationSection embedded \/>\}/);
  assert.match(directory, /view==="register"\?<RegistrationContent/);
  assert.match(directory, /<BoStaffsViews selected=\{view\} onSelect=\{selectView\}/);
  assert.doesNotMatch(staff, /readStaffCenterApplications\(/);
  assert.match(staff, /throw Error\("Danh s\\u00e1ch nh\\u00e2n s\\u1ef1 theo c\\u01a1 s\\u1edf t\\u1ea1m th\\u1eddi ch\\u01b0a kh\\u1ea3 d\\u1ee5ng\."\)/);
  const denied = staff.indexOf("throw Error(");
  const legacy = staff.indexOf("unifiedBoWorkspaceSource.load(key, fetcher, requestedOptions)");
  assert.ok(denied > 0 && legacy > denied, "Staffs must fail closed before any generic reader");
  assert.doesNotMatch(staff, /staffsViewRows\(/);
});
