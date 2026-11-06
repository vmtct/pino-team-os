import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("PAP-1545 / PAP-1316: Core GLOBAL access audit never impersonates Center filtering or editable records", () => {
  const policy = readFileSync("app/bo/components/registration/BoGlobalCenterPolicy.tsx", "utf8");
  const runtime = readFileSync("app/bo/components/registration/BoRuntimeBoundary.tsx", "utf8");
  const coreContract = "access.audit.view";
  assert.match(policy, /VERIFIED_GLOBAL_MODULES = new Set<string>\(\["audits"\]\)/);
  assert.match(policy, new RegExp(coreContract.replace(".", "\\.")));
  assert.match(runtime, /globalAuditWorkspaceSource: BoWorkspaceSource/);
  assert.match(runtime, /key === "audits" \|\| unifiedBoWorkspaceSource\.isModuleReadOnly/);
  assert.match(runtime, /Toàn hệ thống — nhật ký truy cập không lọc theo cơ sở đã chọn/);
  assert.match(runtime, /if \(moduleKey === "audits"\) return <BoRegistrationWorkspace/);
  assert.match(runtime, /source=\{globalAuditWorkspaceSource\} moduleKey="audits"/);
  assert.doesNotMatch(runtime, /source=\{globalAuditWorkspaceSource\} moduleKey="staffs"/);
});
