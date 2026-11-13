import test from "node:test";
import assert from "node:assert/strict";
import { decideHostBoundary } from "./host-boundary";

// PAP-1931 / SCH-STUDENT-MGMT: source-only host admission, not an ACL waiver.
// The BO facade/Core independently require selected-Center auth, CAS and audit.
const centerBoundStudentId = "01a12345-6789-7abc-8def-0123456789ab";
const genderPath = `/api/bo/students/${centerBoundStudentId}/gender`;
const namePath = `/api/bo/students/${centerBoundStudentId}`;
const BO_STAGE = "bo.staging.pinohouse.art";

test("PAP-1931 admits only exact BO Staging Gender PATCH", () => {
  assert.deepEqual(decideHostBoundary(BO_STAGE, genderPath, "PATCH"), { action: "next" });
  assert.deepEqual(decideHostBoundary(BO_STAGE, namePath, "PATCH"), { action: "next" });
});

test("PAP-1931 fails closed on other hosts, verbs, IDs and descendants", () => {
  for (const host of ["bo.pinohouse.art", "ho.staging.pinohouse.art", "tos.staging.pinohouse.art", "bo.staging.pinohouse.art.evil.invalid"]) {
    assert.deepEqual(decideHostBoundary(host, genderPath, "PATCH"), { action: "not_found" }, host);
  }
  for (const method of ["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS"]) {
    assert.deepEqual(decideHostBoundary(BO_STAGE, genderPath, method), { action: "not_found" }, method);
  }
  for (const path of [
    "/api/bo/students/not-a-uuid/gender",
    "/api/bo/students/00000000-0000-4000-8000-000000000001/gender",
    genderPath + "/",
    genderPath + "/approve",
    genderPath + "-unsafe",
    namePath + "/gender/write",
  ]) {
    assert.deepEqual(decideHostBoundary(BO_STAGE, path, "PATCH"), { action: "not_found" }, path);
  }
  assert.deepEqual(decideHostBoundary(BO_STAGE, namePath, "POST"), { action: "not_found" });
});
