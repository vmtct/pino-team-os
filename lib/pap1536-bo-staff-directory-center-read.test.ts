// PAP-1536 / Epic PAP-220 — fail-closed until PAP-1537 Core
// Staff↔Center membership and exact scoped reader are available.
// Never present global Staff rows as Center-scoped records.
import test from "node:test";
import assert from "node:assert/strict";
import { handleBoOperationalReadRequest, type BoReadEnv } from "./bo-read-handler";
import type { BoAccessCoreBinding, BoAccessRequest } from "./bo-core";

const center = "01912345-6789-7abc-8def-0123456789ab";
const phantom = "00000000-0000-4000-8000-000000000000";
const path = "workforce/staff-records";
const cookie = "pino_staff_password_session=synthetic-staff-session";
const makeRequest = (query: string, auth = true) => new Request(
  "https://bo.staging.pinohouse.art/api/bo/" + path + query,
  { headers: auth ? { cookie } : {} },
);
const env = (binding: BoAccessCoreBinding): BoReadEnv => ({ PINO_BO_CORE: binding });

test("PAP-1536 returns 503 before Core for valid-format Center, including unknown Center", async () => {
  const forwarded: BoAccessRequest[] = [];
  const binding: BoAccessCoreBinding = {
    async executeWithStaffPassword(request) {
      forwarded.push(request);
      // Intentionally represents dangerous pre-PAP-1537 global Core success.
      return { status: 200, body: { data: [{ id: "GLOBAL_STAFF_ROW" }] }, requestId: "unsafe-core" };
    },
  };
  for (const id of [center, phantom]) {
    const response = await handleBoOperationalReadRequest(makeRequest("?centerId=" + id), env(binding), path);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, "STAFF_CENTER_DIRECTORY_NOT_READY");
    assert.equal(response.headers.get("x-request-id"), null);
  }
  assert.deepEqual(forwarded, [], "No Core global read is permitted with a Center claim");
});

test("PAP-1536 preserves legacy no-Center request shape and Core 403", async () => {
  const forwarded: BoAccessRequest[] = [];
  const binding: BoAccessCoreBinding = {
    async executeWithStaffPassword(request) {
      forwarded.push(request);
      return { status: 403, body: { error: { code: "ACCESS_PERMISSION_DENIED" } }, requestId: "legacy-denied" };
    },
  };
  const response = await handleBoOperationalReadRequest(makeRequest(""), env(binding), path);
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("x-request-id"), "legacy-denied");
  assert.deepEqual(forwarded, [{ method: "GET", path }]);
});

test("PAP-1536 rejects duplicate, malformed and identity query overrides before Core", async () => {
  const forwarded: BoAccessRequest[] = [];
  const binding: BoAccessCoreBinding = {
    async executeWithStaffPassword(request) {
      forwarded.push(request);
      return { status: 200, body: { data: [] }, requestId: "unexpected-core" };
    },
  };
  for (const query of [
    "?centerId=",
    "?centerId=forged",
    "?centerId=" + center + "&centerId=" + center,
    "?centerId=" + center + "&userId=forged",
    "?centerId=" + center + "&email=forged",
    "?centerId=" + center + "&limit=0",
    "?staffMemberId=" + center,
    "?centerId=%00",
  ]) {
    const response = await handleBoOperationalReadRequest(makeRequest(query), env(binding), path);
    assert.equal(response.status, 400, query);
  }
  assert.equal(forwarded.length, 0);
});

test("PAP-1536 unauthenticated scoped request fails 401 before Core", async () => {
  let coreCalled = false;
  const binding: BoAccessCoreBinding = {
    async executeWithStaffPassword() {
      coreCalled = true;
      return { status: 200, body: { data: [] }, requestId: "unexpected" };
    },
  };
  const response = await handleBoOperationalReadRequest(makeRequest("?centerId=" + center, false), env(binding), path);
  assert.equal(response.status, 401);
  assert.equal(coreCalled, false);
});
