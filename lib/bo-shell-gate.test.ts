import test from "node:test";
import assert from "node:assert/strict";
import { authorizeBoShell, BoShellGateError, type BoShellGateEnv } from "./bo-shell-gate";
import type { BoAccessCoreBinding, BoAccessRequest } from "./bo-core";

function headers(authenticated = true) { return new Headers(authenticated ? { cookie: "pino_staff_password_session=local-session-token" } : {}); }
function env(binding: BoAccessCoreBinding): BoShellGateEnv { return { PINO_BO_CORE: binding }; }
function bindingWith(operation: (request: BoAccessRequest, token: string) => Promise<{status:number;body:unknown;requestId:string}>): BoAccessCoreBinding {
  return {  executeWithStaffPassword: operation };
}
function context(email = "founder@example.com", staffMemberId: string | null = null) {
  return { status: 200, body: { data: { userId: "canonical-user", email, staffMemberId, surface: "BO", entitled: true } }, requestId: "context" };
}

test("valid local-password BO principal is authorized before shell render", async () => {
  const requests: BoAccessRequest[] = []; let token = "";
  const result = await authorizeBoShell(headers(), env(bindingWith(async (request, value) => { requests.push(request); token = value; return context(); })));
  assert.deepEqual(requests, [{ method: "GET", path: "context" }]);
  assert.equal(token, "local-session-token"); assert.equal(result.entitled, true);
});

test("COO-style BO entitlement is accepted without Founder role proof", async () => {
  const result = await authorizeBoShell(headers(), env(bindingWith(async () => context("coo@example.com", "staff-coo"))));
  assert.equal(result.staffMemberId, "staff-coo");
});

test("Core BO entitlement denial fails closed", async () => {
  await assert.rejects(authorizeBoShell(headers(), env(bindingWith(async () => ({ status: 403, body: { error: { code: "ACCESS_SURFACE_DENIED" } }, requestId: "denied" })))),
    (error: unknown) => error instanceof BoShellGateError && error.status === 403 && error.code === "ACCESS_SURFACE_DENIED");
});

test("missing local password session fails before Core", async () => {
  let called = false;
  await assert.rejects(authorizeBoShell(headers(false), env(bindingWith(async () => { called = true; throw new Error("unexpected"); }))),
    (error: unknown) => error instanceof BoShellGateError && error.status === 401);
  assert.equal(called, false);
});

test("Core outage fails the BO shell gate closed", async () => {
  await assert.rejects(authorizeBoShell(headers(), env(bindingWith(async () => { throw new Error("core unavailable"); }))),
    (error: unknown) => error instanceof BoShellGateError && error.status === 503);
});

test("malformed successful Core projection cannot authorize the BO shell", async () => {
  await assert.rejects(authorizeBoShell(headers(), env(bindingWith(async () => ({ status: 200, body: { data: { userId: "u", email: "x", surface: "TOS", entitled: true } }, requestId: "bad" })))),
    (error: unknown) => error instanceof BoShellGateError && error.status === 403);
});

test("workers.dev staging flags cannot substitute a human password session", async () => {
  let called = false;
  await assert.rejects(authorizeBoShell(new Headers({ host: "pino-team-os-staging.example.workers.dev" }), {
    ...env(bindingWith(async () => { called = true; throw new Error("unexpected"); })), }), (error: unknown) => error instanceof BoShellGateError && error.status === 401);
  assert.equal(called, false);
});
