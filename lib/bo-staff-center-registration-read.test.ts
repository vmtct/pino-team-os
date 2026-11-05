// PAP-1407 / PAP-220 — BFF forwards Center-only Staff applicant reads.
import test from "node:test";
import assert from "node:assert/strict";
import { handleBoOperationalReadRequest, isOperationalReadPath, type BoReadEnv } from "./bo-read-handler";
import type { BoAccessCoreBinding, BoAccessRequest } from "./bo-core";

const center = "01912345-6789-7abc-8def-0123456789ab";
const requestId = "01922345-6789-7abc-8def-0123456789ab";
const root = "workforce/staff-center-registration-requests";
const cookie = { cookie: "pino_staff_password_session=synthetic-staff-session" };
const env = (binding: BoAccessCoreBinding): BoReadEnv => ({ PINO_BO_CORE: binding });
const req = (path: string, query: string, auth = true) =>
  new Request("https://bo.staging.pinohouse.art/api/bo/" + path + query, { headers: auth ? cookie : {} });

test("PAP-1407 BO BFF admits only the exact Center-bound list and pending detail", async () => {
  const forwarded: BoAccessRequest[] = [];
  const binding: BoAccessCoreBinding = {
    async executeWithStaffPassword(request, token) {
      assert.equal(token, "synthetic-staff-session");
      forwarded.push(request);
      return { status: 200, body: { data: [] }, requestId: "center-only" };
    },
  };
  for (const path of [root, root + "/" + requestId]) {
    const response = await handleBoOperationalReadRequest(req(path, "?centerId=" + center), env(binding), path);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-request-id"), "center-only");
  }
  assert.deepEqual(forwarded, [
    { method: "GET", path: root, resource: { centerId: center } },
    { method: "GET", path: root + "/" + requestId, resource: { centerId: center } },
  ]);
  for (const path of [root + "/", root + "/extra", root + "/invalid", root + "/" + requestId + "/approve"]) {
    assert.equal(isOperationalReadPath(path), false);
    assert.equal((await handleBoOperationalReadRequest(req(path, "?centerId=" + center), env(binding), path)).status, 404);
  }
  assert.equal(forwarded.length, 2);
});

test("PAP-1407 BO BFF rejects missing/duplicate/forged Center and identity parameters before Core", async () => {
  const forwarded: BoAccessRequest[] = [];
  const binding: BoAccessCoreBinding = {
    async executeWithStaffPassword(request) {
      forwarded.push(request);
      return { status: 200, body: { data: [] }, requestId: "should-not-call" };
    },
  };
  for (const query of [
    "", "?centerId=", "?centerId=forged", "?centerId=" + center + "&centerId=" + center,
    "?centerId=" + center + "&userId=forged", "?email=forged&centerId=" + center,
    "?centerId=" + center + "&limit=10000",
  ]) {
    assert.equal((await handleBoOperationalReadRequest(req(root, query), env(binding), root)).status, 400, query);
  }
  assert.equal((await handleBoOperationalReadRequest(req(root, "?centerId=" + center, false), env(binding), root)).status, 401);
  assert.equal(forwarded.length, 0);
});

test("PAP-1407 BO BFF preserves protected Core denial without Global fallback", async () => {
  const forwarded: BoAccessRequest[] = [];
  const binding: BoAccessCoreBinding = {
    async executeWithStaffPassword(request) {
      forwarded.push(request);
      return { status: 403, body: { error: { code: "ACCESS_PERMISSION_DENIED" } }, requestId: "staff-denied" };
    },
  };
  const response = await handleBoOperationalReadRequest(req(root, "?centerId=" + center), env(binding), root);
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("x-request-id"), "staff-denied");
  assert.deepEqual(forwarded, [{ method: "GET", path: root, resource: { centerId: center } }]);
});
