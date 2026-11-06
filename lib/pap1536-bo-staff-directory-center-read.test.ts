// PAP-1536 / Epic PAP-220: BO Staff directory must never gain GLOBAL ACL
// by forwarding a caller-provided Center. This is a bounded BFF READ only.
// PAP-1537 owns canonical Staff↔Center membership and Core read authorization.
import test from "node:test";
import assert from "node:assert/strict";
import { handleBoOperationalReadRequest, type BoReadEnv } from "./bo-read-handler";
import type { BoAccessCoreBinding, BoAccessRequest } from "./bo-core";

const center = "01912345-6789-7abc-8def-0123456789ab";
const path = "workforce/staff-records";
const cookie = "pino_staff_password_session=synthetic-staff-session";
const makeRequest = (query: string, auth = true) => new Request(
  "https://bo.staging.pinohouse.art/api/bo/" + path + query,
  { headers: auth ? { cookie } : {} },
);
const env = (binding: BoAccessCoreBinding): BoReadEnv => ({ PINO_BO_CORE: binding });

test("PAP-1536 forwards only the explicit Center read constraint, not an authorization grant", async () => {
  const forwarded: BoAccessRequest[] = [];
  const binding: BoAccessCoreBinding = {
    async executeWithStaffPassword(request, credential) {
      assert.equal(credential, "synthetic-staff-session");
      forwarded.push(request);
      // Core remains the security authority and may still deny a scoped Manager.
      return { status: 403, body: { error: { code: "ACCESS_PERMISSION_DENIED" } }, requestId: "deny-scoped" };
    },
  };
  const response = await handleBoOperationalReadRequest(makeRequest("?centerId=" + center), env(binding), path);
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("x-request-id"), "deny-scoped");
  assert.deepEqual(forwarded, [{ method: "GET", path, resource: { centerId: center } }]);
});

test("PAP-1536 preserves legacy request shape without a Center, never infers GLOBAL", async () => {
  const forwarded: BoAccessRequest[] = [];
  const binding: BoAccessCoreBinding = {
    async executeWithStaffPassword(request) {
      forwarded.push(request);
      return { status: 403, body: { error: { code: "ACCESS_PERMISSION_DENIED" } }, requestId: "legacy-denied" };
    },
  };
  assert.equal((await handleBoOperationalReadRequest(makeRequest(""), env(binding), path)).status, 403);
  assert.deepEqual(forwarded, [{ method: "GET", path }]);
});

test("PAP-1536 rejects duplicate, missing-value, malformed and identity query overrides before Core", async () => {
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

test("PAP-1536 unauthenticated request fails before Core even with syntactically valid Center", async () => {
  let coreCalled = false;
  const binding: BoAccessCoreBinding = {
    async executeWithStaffPassword() {
      coreCalled = true;
      return { status: 200, body: { data: [] }, requestId: "unexpected" };
    },
  };
  assert.equal((await handleBoOperationalReadRequest(makeRequest("?centerId=" + center, false), env(binding), path)).status, 401);
  assert.equal(coreCalled, false);
});
