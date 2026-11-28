import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decideHostBoundary } from "./host-boundary";
import { handleHoStaffPasswordReset, resetTarget, type HoStaffPasswordResetEnv } from "./ho-staff-password-reset-facade";
import { findResetAccount } from "../app/ho/staff/StaffPasswordReset";
import type { BoAccessSystemUser } from "./bo-access-model";

const staff = "00000000-0000-4000-8000-000000000099";
const actor = "00000000-0000-4000-8000-000000000001";
const user = "00000000-0000-4000-8000-000000000002";
const ho = "ho.staging.pinohouse.art";
const path = `/api/ho/staff/${staff}/password-reset`;
const env = { APP_ENV: "staging" } as HoStaffPasswordResetEnv;
function request(host = ho, origin = `https://${ho}`, body = "{}") {
  return new Request(`https://${host}${path}`, { method: "POST",
    headers: { host, origin, "content-type": "application/json", "idempotency-key": "pap1144-test-1" }, body });
}
test("PAP-1144 HO host admits ONLY exact staging POST reset route", () => {
  assert.deepEqual(decideHostBoundary(ho, path, "POST"), { action: "next" });
  for (const method of ["GET", "DELETE", "PUT"] as const)
    assert.deepEqual(decideHostBoundary(ho, path, method), { action: "not_found" });
  for (const hostname of ["bo.staging.pinohouse.art", "bo.pinohouse.art", "tos.staging.pinohouse.art", "localhost"])
    assert.deepEqual(decideHostBoundary(hostname, path, "POST"), { action: "not_found" });
  assert.deepEqual(decideHostBoundary(ho, path + "/other", "POST"), { action: "not_found" });
});
test("Reset BFF denies invalid host, origin, replay key and nonempty payload before touching Core", async () => {
  assert.equal((await handleHoStaffPasswordReset(request("bo.pinohouse.art"), env, staff)).status, 404);
  assert.equal((await handleHoStaffPasswordReset(request(ho, "https://evil.invalid"), env, staff)).status, 403);
  assert.equal((await handleHoStaffPasswordReset(request(ho, `https://${ho}`, '{"password":"chosen"}'), env, staff)).status, 400);
  assert.equal((await handleHoStaffPasswordReset(request(), { ...env, APP_ENV: "production" }, staff)).status, 404);
  assert.equal((await handleHoStaffPasswordReset(request(), env, "no-uuid")).status, 404);
  const response = await handleHoStaffPasswordReset(request(), env, staff);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.ok([401, 403].includes(response.status), "without authenticated HO session no Core write is allowed");
});
test("Reset target must be one active mapped Access principal, not self", () => {
  const rows = [{ id: user, staffMemberId: staff, status: "active", email: "staff@example.test", assignments: [] }];
  assert.deepEqual(resetTarget(rows, staff, actor), { status: 200, userId: user });
  assert.deepEqual(resetTarget(rows, staff, user), { status: 403 });
  assert.deepEqual(resetTarget([{ ...rows[0], status: "suspended" }], staff, actor), { status: 409 });
  assert.deepEqual(resetTarget([], staff, actor), { status: 404 });
  assert.deepEqual(resetTarget([...rows, ...rows], staff, actor), { status: 502 });
  assert.deepEqual(findResetAccount(rows as BoAccessSystemUser[], staff, actor), { state: "ready", userId: user, email: "staff@example.test" });
  assert.equal(findResetAccount(rows as BoAccessSystemUser[], staff, user).state, "unavailable");
});
test("HO Staff Detail binds reset only in its own registered Overview, without mock credentials", () => {
  const hoSource = readFileSync("app/ho/staff/StaffTdd.tsx", "utf8");
  const ui = readFileSync("app/ho/staff/StaffPasswordReset.tsx", "utf8");
  assert.match(hoSource, /detailOverview=\{/);
  assert.match(hoSource, /access\.staff_password\.reset/);
  assert.match(ui, /window\.confirm/);
  assert.match(ui, /\/api\/ho\/staff\//);
  assert.match(ui, /setTemporaryPassword\(null\)/);
  assert.doesNotMatch(ui, /localStorage|sessionStorage|console\./);
});

test("PAP-2436 uses the admitted Access transport and preserves failure boundaries", async () => {
  for (const scenario of ["founder-denied", "directory-denied", "target-missing", "core-denied", "core-success"] as const) {
    const calls: string[] = [];
    const fakeEnv: HoStaffPasswordResetEnv = {
      APP_ENV: "staging", HO_PILOT_FOUNDER_USER_IDS: actor,
      PINO_BO_CORE: {
        async executeWithStaffPassword(command, session) {
          assert.equal(session, "synthetic-test-session");
          calls.push(`${command.method} ${command.path}`);
          const reply = (status: number, body: unknown) => ({status, body, requestId: "synthetic-only"});
          if (command.path === "context") return reply(200, {data:{userId:actor,email:"actor@pino.invalid",surface:"BO",entitled:true,permissionKeys:["access.staff_password.reset"]}});
          if (command.path === "ho/admission") return reply(200, {data:{admitted:scenario !== "founder-denied"}});
          if (command.path === "access/users") return scenario === "directory-denied" ? reply(403, {error:{code:"DENIED"}}) : reply(200,{data:scenario === "target-missing" ? [] : [{id:user,staffMemberId:staff,status:"active"}]});
          assert.equal(command.path, `access/users/${user}/staff-password/reset`);
          assert.equal(command.method, "POST");
          assert.deepEqual(command.body, {});
          assert.equal(command.idempotencyKey, "pap1144-test-1");
          return scenario === "core-denied" ? reply(403,{error:{code:"DENIED"}}) : reply(200,{data:{userId:user,staffMemberId:staff}});
        },
      },
    };
    const req = request();
    req.headers.set("cookie", "pino_staff_password_session=synthetic-test-session");
    const result = await handleHoStaffPasswordReset(req,fakeEnv,staff);
    const expected = scenario === "core-success" ? 200 : scenario === "target-missing" ? 404 : 403;
    assert.equal(result.status, expected, scenario);
    const expectedCalls = ["GET context", "GET ho/admission"];
    if (scenario !== "founder-denied") expectedCalls.push("GET access/users");
    if (scenario === "core-denied" || scenario === "core-success") expectedCalls.push(`POST access/users/${user}/staff-password/reset`);
    assert.deepEqual(calls, expectedCalls, scenario);
    assert.equal(result.headers.get("cache-control"), "no-store");
  }
});
