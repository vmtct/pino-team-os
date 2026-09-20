import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Staff detail composes bounded read-only Pinoria section", async () => {
  const [api, model, view] = await Promise.all([
    readFile("lib/bo-api.ts", "utf8"),
    readFile("lib/bo-model.ts", "utf8"),
    readFile("app/bo/staff/StaffManagementView.tsx", "utf8"),
  ]);
  assert.match(api, /staffPinoria:\s*\(staffMemberId: string\)\s*=>\s*readOne<BoStaffPinoriaProjection>/);
  assert.match(api, /workforce\/staff-records\/\$\{encodeURIComponent\(staffMemberId\)\}\/pinoria/);
  assert.match(view, /data-testid="staff-pinoria-panel"/);
  assert.match(view, /Staff detail chỉ đọc canonical identity/);
  assert.doesNotMatch(view, /staffPinoria(?:Create|Update|Provision|Link)|pinoriaSelfId=.*fetch|\/pinoria\/provision/);

  const projection = model.slice(model.indexOf("export interface BoStaffPinoriaProjection"), model.indexOf("export type BoStaffProfilePatch"));
  for (const forbidden of ["email", "mobile", "salary", "payroll", "bank", "governmentId", "document", "audit", "assignment"]) {
    assert.doesNotMatch(projection, new RegExp(forbidden, "i"), forbidden);
  }
});
