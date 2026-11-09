// PAP-1407 / PAP-220 — Founder HO Staff link BFF contract negative tests.
import test from "node:test";
import assert from "node:assert/strict";
import {
  parseHoStaffLinkPath, parseHoStaffLinkStatus, parseHoStaffLinkView, parseHoStaffLinkResponse,
} from "./ho-staff-center-links-facade";

const CENTER = "01912345-6789-7abc-8def-0123456789ab";
const ROOT = "/api/ho/staff-center-links/" + CENTER;
const token = "a".repeat(43);
test("PAP-1407: only current Center GET and status POST translate to Core Founder routes", () => {
  assert.deepEqual(parseHoStaffLinkPath(ROOT, "GET"), {
    centerId: CENTER, corePath: "workforce/staff-center-registration-links/" + CENTER, kind: "read",
  });
  assert.deepEqual(parseHoStaffLinkPath(ROOT + "/status", "POST"), {
    centerId: CENTER, corePath: "workforce/staff-center-registration-links/" + CENTER + "/status", kind: "status",
  });
});
test("PAP-1407: methods, extra paths, BO/global and forged IDs are not admitted", () => {
  for (const [path, method] of [
    [ROOT, "POST"], [ROOT, "DELETE"], [ROOT + "/status", "GET"], [ROOT + "/status", "PATCH"],
    [ROOT + "/approve", "POST"], [ROOT + "/status/extra", "POST"],
    [ROOT + "/", "GET"], [ROOT + "?centerId=forged", "GET"],
    ["/api/ho/staff-center-links/forged", "GET"],
    ["/api/bo/staff-center-links/" + CENTER, "GET"],
    ["/api/ho/staff-registration-settings", "GET"],
  ]) assert.equal(parseHoStaffLinkPath(path, method), null);
});
test("PAP-1407: status command requires strict boolean, safe CAS version, no Access fields", () => {
  assert.deepEqual(parseHoStaffLinkStatus({ enabled: true, expectedVersion: 0 }),
    { enabled: true, expectedVersion: 0 });
  for (const x of [
    null, false, {}, [], { enabled: true }, { enabled: "true", expectedVersion: 1 },
    { enabled: false, expectedVersion: -1 }, { enabled: false, expectedVersion: 1.3 },
    { enabled: false, expectedVersion: "1" },
    { enabled: true, expectedVersion: 1, roles: ["founder"] },
    { enabled: true, expectedVersion: 1, accessUserId: CENTER },
    { enabled: true, expectedVersion: 1, centerId: CENTER },
  ]) assert.equal(parseHoStaffLinkStatus(x), null);
});
test("PAP-1407: Founder response projection accepts only exact Center and safe HMAC token", () => {
  assert.deepEqual(parseHoStaffLinkView({
    centerId: CENTER, token, enabled: false, version: 0, updatedAt: null,
  }, CENTER), { centerId: CENTER, token, enabled: false, version: 0, updatedAt: null });
  for (const x of [
    { centerId: "01912345-6789-7abc-8def-0123456789ac", token, enabled: true, version: 1, updatedAt: null },
    { centerId: CENTER, token: "forged", enabled: true, version: 1, updatedAt: null },
    { centerId: CENTER, token, enabled: "true", version: 1, updatedAt: null },
    { centerId: CENTER, token, enabled: true, version: -1, updatedAt: null },
    { centerId: CENTER, token, enabled: true, version: 1.5, updatedAt: null },
  ]) assert.equal(parseHoStaffLinkView(x, CENTER), null);
});

test("PAP-1540: Core write receipt is distinct from Founder link GET DTO", () => {
  const coreReceipt = { centerId: CENTER, token, enabled: true, version: 1, replayed: false };
  assert.equal(parseHoStaffLinkView(coreReceipt, CENTER), null,
    "GET shape requires updatedAt; Core writer intentionally omits it");
  assert.deepEqual(parseHoStaffLinkResponse(coreReceipt, CENTER, "status"), {
    centerId: CENTER, token, enabled: true, version: 1, updatedAt: null,
  });
  assert.equal(parseHoStaffLinkResponse(coreReceipt, CENTER, "read"), null,
    "GET must never silently accept a writer receipt");
  assert.deepEqual(parseHoStaffLinkResponse({
    ...coreReceipt, enabled: false, version: 2, replayed: true,
  }, CENTER, "status"), {
    centerId: CENTER, token, enabled: false, version: 2, updatedAt: null,
  });
  assert.deepEqual(parseHoStaffLinkResponse({
    centerId: CENTER, token, enabled: false, version: 2, updatedAt: "2026-11-06T07:00:00.000Z",
  }, CENTER, "read"), {
    centerId: CENTER, token, enabled: false, version: 2, updatedAt: "2026-11-06T07:00:00.000Z",
  });
});
test("PAP-1540: write receipt rejects forged Center, malformed token, Access or ambiguous fields", () => {
  const receipt = { centerId: CENTER, token, enabled: true, version: 1, replayed: false };
  for (const value of [
    null, {}, [],
    { ...receipt, centerId: "01912345-6789-7abc-8def-0123456789ac" },
    { ...receipt, token: "invalid" },
    { ...receipt, enabled: "true" },
    { ...receipt, version: -1 },
    { ...receipt, version: 1.5 },
    { ...receipt, replayed: undefined },
    { ...receipt, replayed: "false" },
    { ...receipt, updatedAt: 42 },
    { ...receipt, accessUserId: CENTER },
    { ...receipt, password: "secret" },
  ]) assert.equal(parseHoStaffLinkResponse(value, CENTER, "status"), null);
});
