import test from "node:test";
import assert from "node:assert/strict";
import { boCenterModuleScope, boScopedModuleHref } from "../app/bo/components/registration/BoGlobalCenterPolicy";

const A = "0199f001-0000-7000-8000-000000000001";
const B = "0199f001-0000-7000-8000-000000000002";

test("PAP-1329 / Epic PAP-1316: CI admits Payroll only as a verified CENTER module", () => {
  for (const moduleKey of ["payroll-periods", "workforce-shift-plans", "workforce-availability", "workforce-assignments"])
    assert.equal(boCenterModuleScope(moduleKey), "CENTER");
  // An unrelated mixed transactional domain does not inherit Payroll admission.
  assert.equal(boCenterModuleScope("subscriptions"), "MIXED");
});

test("PAP-1329: payroll route carries only an authorized master Center and discards old detail", () => {
  assert.equal(
    boScopedModuleHref("/bo/payroll-periods?record=old-period", "payroll-periods", A, [A]),
    "/bo/payroll-periods?centerId=" + A,
  );
  assert.equal(boScopedModuleHref("/bo/payroll-periods", "payroll-periods", B, [A]),
    "/bo/payroll-periods");
  assert.equal(
    boScopedModuleHref("https://evil.invalid/bo/payroll-periods", "payroll-periods", A, [A]),
    "https://evil.invalid/bo/payroll-periods",
  );
  assert.equal(
    boScopedModuleHref("/bo/workforce-shift-plans", "payroll-periods", A, [A]),
    "/bo/workforce-shift-plans",
  );
});
