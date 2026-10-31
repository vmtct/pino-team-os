import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { handleBoMissionAssignmentWrite, isBoMissionAssignmentWritePath, type BoMissionWriteEnv } from "./bo-mission-assignment-write-facade";
import { decideHostBoundary } from "./host-boundary";
import type { BoAccessRequest } from "./bo-core";

const center = "01900000-0000-7000-8000-000000000001";
const student = "01900000-0000-7000-8000-000000000002";
const mission = "01900000-0000-7000-8000-000000000003";
const assignment = "01900000-0000-7000-8000-000000000004";
const base = "https://bo.staging.pinohouse.art/api/bo/learning/mission-assignments";
const key = "pap1210-write-test-0001";
const body = { centerId: center, studentId: student, missionId: mission, contextLabel: "Tập nét" };
function setup(status = 201) {
  const calls: BoAccessRequest[] = [];
  const env: BoMissionWriteEnv = {
    APP_ENV: "staging",
    PINO_BO_CORE: { async executeWithStaffPassword(request, token) {
      assert.equal(token, "synthetic-staff-session");
      calls.push(request);
      return { status, body: status < 400 ? { data: { id: assignment, version: 1 } } :
        { error: { code: status === 403 ? "ACCESS_PERMISSION_DENIED" : "PLATFORM_CONFLICT" } },
        requestId: "core-request-1210" };
    } },
  };
  return { env, calls };
}
function req(path = "", method = "POST", data: unknown = body, config: {
  host?: string; origin?: string; key?: string; cookie?: string; contentType?: string;
} = {}): Request {
  const url = new URL(base + path);
  url.searchParams.set("centerId", center);
  return new Request(url, { method,
    headers: { host: config.host ?? "bo.staging.pinohouse.art",
      origin: config.origin ?? "https://bo.staging.pinohouse.art",
      "content-type": config.contentType ?? "application/json",
      "idempotency-key": config.key ?? key,
      ...(config.cookie === "" ? {} : { cookie: "pino_staff_password_session=" + (config.cookie ?? "synthetic-staff-session") }) },
    body: JSON.stringify(data),
  });
}
test("PAP-1210: generic BO route dispatches only declared Assignment commands", () => {
  const route = readFileSync("app/api/bo/[...path]/route.ts", "utf8");
  const handlers = route.match(/isBoMissionAssignmentWritePath\(joined\)/g) ?? [];
  assert.equal(handlers.length, 2, "only POST and PUT dispatch write facade");
  assert.match(route, /handleBoMissionAssignmentWrite\(request, env, joined\)/);
});
test("PAP-1210: exact staging-only BO write host fence, no HO/TOS/Production/unknown verb", () => {
  for (const [path, verb] of [
    ["/api/bo/learning/mission-assignments", "POST"],
    ["/api/bo/learning/mission-assignments/" + assignment, "PUT"],
    ["/api/bo/learning/mission-assignments/" + assignment + "/cancel", "POST"],
  ]) {
    assert.deepEqual(decideHostBoundary("bo.staging.pinohouse.art", path, verb), { action: "next" });
    for (const host of ["bo.pinohouse.art", "ho.staging.pinohouse.art", "tos.staging.pinohouse.art"]) {
      assert.equal(decideHostBoundary(host, path, verb).action, "not_found");
    }
    for (const badVerb of ["DELETE", "PATCH", "HEAD"]) {
      assert.equal(decideHostBoundary("bo.staging.pinohouse.art", path, badVerb).action, "not_found");
    }
  }
  assert.equal(isBoMissionAssignmentWritePath("learning/mission-assignments"), true);
  assert.equal(isBoMissionAssignmentWritePath("learning/mission-assignments/" + assignment + "/cancel"), true);
  assert.equal(isBoMissionAssignmentWritePath("learning/mission-assignments/" + assignment + "/complete"), false);
});
test("PAP-1210: Center-bound Create/Update/Cancel forward exact Core contract and idempotency", async () => {
  for (const [path, method, data, status, expected] of [
    ["", "POST", body, 201, { ...body }],
    ["/" + assignment, "PUT", { centerId: center, expectedVersion: 3, contextLabel: "Thực hành" }, 200,
      { centerId: center, expectedVersion: 3, contextLabel: "Thực hành" }],
    ["/" + assignment + "/cancel", "POST", { centerId: center, expectedVersion: 4, reason: "Đổi mục tiêu" }, 200,
      { centerId: center, expectedVersion: 4, reason: "Đổi mục tiêu" }],
  ] as const) {
    const { env, calls } = setup(status);
    const result = await handleBoMissionAssignmentWrite(req(path, method, data), env,
      "learning/mission-assignments" + path);
    assert.equal(result.status, status);
    assert.equal(result.headers.get("x-request-id"), "core-request-1210");
    assert.deepEqual(calls, [{ method, path: "learning/mission-assignments" + path, body: expected,
      idempotencyKey: key }]);
  }
});
test("PAP-1210: no auth, denied, conflict and Core outage never fabricate successful write", async () => {
  const { env, calls } = setup(403);
  const denied = await handleBoMissionAssignmentWrite(req(), env, "learning/mission-assignments");
  assert.equal(denied.status, 403);
  assert.equal((await denied.json()).error.code, "ACCESS_PERMISSION_DENIED");
  assert.equal(calls.length, 1);
  const missing = await handleBoMissionAssignmentWrite(req("", "POST", body, { cookie: "" }), env, "learning/mission-assignments");
  assert.equal(missing.status, 401);
  assert.equal(calls.length, 1);
  const conflict = setup(409);
  assert.equal((await handleBoMissionAssignmentWrite(req(), conflict.env, "learning/mission-assignments")).status, 409);
  const broken: BoMissionWriteEnv = { APP_ENV: "staging", PINO_BO_CORE: {
    async executeWithStaffPassword() { throw Error("Core unavailable"); } } };
  assert.equal((await handleBoMissionAssignmentWrite(req(), broken, "learning/mission-assignments")).status, 503);
});
test("PAP-1210: malformed input, cross-Center scope, forged actor and CSRF denied before Core call", async () => {
  const { env, calls } = setup();
  for (const data of [
    { ...body, centerId: student }, { ...body, studentId: "not-id" },
    { ...body, missionId: "bad" }, { ...body, actorId: student },
    { ...body, status: "COMPLETED" }, { ...body, contextLabel: "x".repeat(201) },
  ]) assert.equal((await handleBoMissionAssignmentWrite(req("", "POST", data), env, "learning/mission-assignments")).status, 400);
  for (const [path, method, data] of [
    ["/" + assignment, "PUT", { centerId: center, expectedVersion: 0, contextLabel: "Test" }],
    ["/" + assignment, "PUT", { centerId: center, expectedVersion: 1 }],
    ["/" + assignment, "PUT", { centerId: center, expectedVersion: 1, contextLabel: "Test", studentId: student }],
    ["/" + assignment + "/cancel", "POST", { centerId: center, expectedVersion: 1, reason: "" }],
  ] as const) assert.equal((await handleBoMissionAssignmentWrite(req(path, method, data), env,
    "learning/mission-assignments" + path)).status, 400);
  assert.equal((await handleBoMissionAssignmentWrite(req("", "POST", body, { origin: "https://evil.example" }), env,
    "learning/mission-assignments")).status, 403);
  assert.equal((await handleBoMissionAssignmentWrite(req("", "POST", body, { key: "short" }), env,
    "learning/mission-assignments")).status, 400);
  assert.equal((await handleBoMissionAssignmentWrite(req("", "POST", body, { host: "bo.pinohouse.art" }), env,
    "learning/mission-assignments")).status, 404);
  assert.equal((await handleBoMissionAssignmentWrite(req(), { ...env, APP_ENV: "production" },
    "learning/mission-assignments")).status, 404);
  assert.equal((await handleBoMissionAssignmentWrite(req("/" + assignment, "POST", body), env,
    "learning/mission-assignments/" + assignment)).status, 405);
  assert.equal((await handleBoMissionAssignmentWrite(req("/" + assignment + "/complete"), env,
    "learning/mission-assignments/" + assignment + "/complete")).status, 404);
  assert.equal(calls.length, 0);
});
