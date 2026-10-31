import assert from "node:assert/strict";
import test from "node:test";
import { decideHostBoundary } from "./host-boundary";
import { BO_SIDEBAR_MODULES } from "./bo-sidebar-routes";

test("PAP BO URL optimizer: enrollment projection is GET-only, Staging-only and exact", () => {
  const p = "/api/bo/school/enrollments";
  assert.deepEqual(decideHostBoundary("bo.staging.pinohouse.art", p, "GET"), { action: "next" });
  for (const method of ["POST", "PATCH", "PUT", "DELETE"]) assert.deepEqual(decideHostBoundary("bo.staging.pinohouse.art", p, method), { action: "not_found" });
  for (const host of ["bo.pinohouse.art", "tos.staging.pinohouse.art", "ho.staging.pinohouse.art"]) assert.deepEqual(decideHostBoundary(host, p, "GET"), { action: "not_found" });
  assert.deepEqual(decideHostBoundary("bo.staging.pinohouse.art", p + "/extra", "GET"), { action: "not_found" });
});

test("PAP BO URL optimizer: approved query modules are explicit and unique", () => {
  assert.deepEqual(BO_SIDEBAR_MODULES, ["students", "classes", "subscriptions", "enrollments", "visits", "staffs", "timekeeping", "salaryPeriods", "audits", "parents", "missions"]);
  assert.equal(BO_SIDEBAR_MODULES.includes("parents"), true, "PAP-1029 Parent must not redirect to Students");
  assert.equal(BO_SIDEBAR_MODULES.includes("missions"), true, "PAP-1210 registered Mission TDD supports BO query entry");
  assert.equal(new Set(BO_SIDEBAR_MODULES).size, BO_SIDEBAR_MODULES.length);
  assert.equal(BO_SIDEBAR_MODULES.includes("invalid"), false);
  assert.equal(BO_SIDEBAR_MODULES.includes("salaryPeriods"), true, "Preserve retired legacy URL recognition; page redirects and unified workspace hides it");
});