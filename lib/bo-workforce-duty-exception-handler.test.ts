import test from "node:test";
import assert from "node:assert/strict";
import { handleBoWorkforceDutyExceptionRequest, type BoWorkforceDutyExceptionEnv } from "./bo-workforce-duty-exception-handler";
import type { BoAccessCoreBinding, BoAccessRequest } from "./bo-core";

const token = "local-password-session";
const centerId = "0198d050-56c1-7ac5-b9ab-b0e45d912345";
const exceptionId = "0198d050-56c1-7ac5-b9ab-b0e45d912346";
const headers = (extra: Record<string, string> = {}) => ({ cookie: `pino_staff_password_session=${token}`, ...extra });
const env = (binding: BoAccessCoreBinding): BoWorkforceDutyExceptionEnv => ({ PINO_BO_CORE: binding });

test("F4 BO list forwards exact Center resource and strips forged identity query", async () => {
  const calls: Array<{ request: BoAccessRequest; token: string }> = [];
  const binding: BoAccessCoreBinding = { async executeWithStaffPassword(request, value) {
    calls.push({ request, token: value }); return { status: 200, body: { data: [] }, requestId: "list-request" };
  } };
  const request = new Request(`https://bo.pinohouse.art/api/bo/workforce/duty/checkout-exceptions?centerId=${centerId}&managerUserId=forged&userId=forged`, { headers: headers() });
  const response = await handleBoWorkforceDutyExceptionRequest(request, env(binding), "workforce/duty/checkout-exceptions");
  assert.equal(response.status, 200); assert.equal(response.headers.get("x-request-id"), "list-request");
  assert.deepEqual(calls, [{ request: { method: "GET", path: "workforce/duty/checkout-exceptions", resource: { centerId } }, token }]);
});

test("F4 BO approve forwards only version + current password with exact Center resource", async () => {
  let forwarded: BoAccessRequest | undefined, forwardedToken = "";
  const binding: BoAccessCoreBinding = { async executeWithStaffPassword(request, value) {
    forwarded = request; forwardedToken = value; return { status: 200, body: { data: { id: exceptionId, status: "APPROVED" } }, requestId: "approve-request" };
  } };
  const request = new Request(`https://bo.pinohouse.art/api/bo/workforce/duty/checkout-exceptions/${exceptionId}/approve?centerId=${centerId}`, {
    method: "POST",
    headers: headers({ "content-type": "application/json" }),
    body: JSON.stringify({ expectedVersion: 2, password: " current password ", managerUserId: "forged", centerId: "forged" }),
  });
  const response = await handleBoWorkforceDutyExceptionRequest(request, env(binding), `workforce/duty/checkout-exceptions/${exceptionId}/approve`);
  assert.equal(response.status, 200); assert.equal(response.headers.get("x-request-id"), "approve-request");
  assert.equal(forwardedToken, token);
  assert.deepEqual(forwarded, {
    method: "POST", path: `workforce/duty/checkout-exceptions/${exceptionId}/approve`, resource: { centerId },
    body: { expectedVersion: 2, password: " current password " },
  });
});

test("F4 BO fails before Core without password session or canonical Center", async () => {
  let called = false;
  const binding: BoAccessCoreBinding = { async executeWithStaffPassword() { called = true; throw new Error("unexpected"); } };
  const noSession = new Request(`https://bo.pinohouse.art/api/bo/workforce/duty/checkout-exceptions?centerId=${centerId}`);
  assert.equal((await handleBoWorkforceDutyExceptionRequest(noSession, env(binding), "workforce/duty/checkout-exceptions")).status, 401);
  const badCenter = new Request("https://bo.pinohouse.art/api/bo/workforce/duty/checkout-exceptions?centerId=forged", { headers: headers() });
  assert.equal((await handleBoWorkforceDutyExceptionRequest(badCenter, env(binding), "workforce/duty/checkout-exceptions")).status, 400);
  assert.equal(called, false);
});

test("F4 BO route/method allowlist and Core denials pass through", async () => {
  let called = false;
  const deny: BoAccessCoreBinding = { async executeWithStaffPassword() { called = true; return { status: 409, body: { error: { code: "WORKFORCE_TIMEKEEPING_CONFLICT" } }, requestId: "stale-request" }; } };
  const unknown = new Request("https://bo.pinohouse.art/api/bo/workforce/duty/delete-all", { headers: headers() });
  assert.equal((await handleBoWorkforceDutyExceptionRequest(unknown, env(deny), "workforce/duty/delete-all")).status, 404);
  assert.equal(called, false);
  const wrongMethod = new Request(`https://bo.pinohouse.art/api/bo/workforce/duty/checkout-exceptions?centerId=${centerId}`, { method: "PUT", headers: headers() });
  assert.equal((await handleBoWorkforceDutyExceptionRequest(wrongMethod, env(deny), "workforce/duty/checkout-exceptions")).status, 405);
  assert.equal(called, false);
  const approval = new Request(`https://bo.pinohouse.art/api/bo/workforce/duty/checkout-exceptions/${exceptionId}/approve?centerId=${centerId}`, { method: "POST", headers: headers({ "content-type": "application/json" }), body: JSON.stringify({ expectedVersion: 1, password: "pw" }) });
  const response = await handleBoWorkforceDutyExceptionRequest(approval, env(deny), `workforce/duty/checkout-exceptions/${exceptionId}/approve`);
  assert.equal(response.status, 409); assert.equal(response.headers.get("x-request-id"), "stale-request");
});
