import test from "node:test";
import assert from "node:assert/strict";
import { handleBoContextRequest, type BoContextEnv } from "./bo-context-handler";
import type { BoAccessCoreBinding, BoAccessRequest } from "./bo-core";

function request(authenticated = true, url = "https://bo.pinohouse.art/api/bo/context?userId=forged&staffMemberId=forged") {
  return new Request(url, { headers: authenticated ? { cookie: "pino_staff_password_session=local-session-token" } : {} });
}
function env(binding: BoAccessCoreBinding): BoContextEnv { return { PINO_BO_CORE: binding }; }
function bindingWith(operation: (request: BoAccessRequest, token: string) => Promise<{status:number;body:unknown;requestId:string}>): BoAccessCoreBinding {
  return {

    executeWithStaffPassword: operation,
  };
}

test("BO context forwards only GET context through local password Core path", async () => {
  let forwardedRequest: BoAccessRequest | undefined, forwardedToken = "";
  const response = await handleBoContextRequest(request(), env(bindingWith(async (coreRequest, token) => {
    forwardedRequest = coreRequest; forwardedToken = token;
    return { status: 200, body: { data: { userId: "canonical-user", email: "bo.user@example.com", staffMemberId: null, surface: "BO", entitled: true } }, requestId: "bo-request-id" };
  })));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-request-id"), "bo-request-id");
  assert.deepEqual(forwardedRequest, { method: "GET", path: "context" });
  assert.equal(forwardedToken, "local-session-token");
  assert.equal(Object.hasOwn(forwardedRequest ?? {}, "body"), false);
});

test("BO context fails before Core without local password session", async () => {
  let called = false;
  const response = await handleBoContextRequest(request(false), env(bindingWith(async () => { called = true; throw new Error("unexpected"); })));
  assert.equal(response.status, 401); assert.equal(called, false);
});

test("Core BO entitlement denial propagates without local fallback", async () => {
  const response = await handleBoContextRequest(request(), env(bindingWith(async () => ({ status: 403, body: { error: { code: "ACCESS_SURFACE_DENIED" } }, requestId: "denied-request-id" }))));
  assert.equal(response.status, 403); assert.equal(response.headers.get("x-request-id"), "denied-request-id");
});

test("the Team OS BO context facade exposes no feature operation", async () => {
  const paths: string[] = [];
  await handleBoContextRequest(request(), env(bindingWith(async coreRequest => { paths.push(`${coreRequest.method} ${coreRequest.path}`); return { status: 200, body: { data: { entitled: true } }, requestId: "request" }; })));
  assert.deepEqual(paths, ["GET context"]);
});

test("workers.dev staging bypass no longer substitutes a human BO identity", async () => {
  let called = false;
  const response = await handleBoContextRequest(request(false, "https://pino-team-os-staging.example.workers.dev/api/bo/context"), {
    ...env(bindingWith(async () => { called = true; throw new Error("unexpected"); })), });
  assert.equal(response.status, 401); assert.equal(called, false);
});
