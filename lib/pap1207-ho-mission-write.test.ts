import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decideHostBoundary, HO_STAGING_HOSTNAME } from "./host-boundary";
import { handleHoMissionWrite, parseHoMissionCommand, type HoMissionWriteEnv } from "./ho-mission-write-facade";
const validId = "01900000-0000-7000-8000-000000000002";
const path = "/api/ho/learning/missions";
const valid = { code: "mori-1", name: "Mori", status: "ACTIVE", level: 1, plsValue: 25,
  paperSize: "A4", description: "Color", guideline: "Explore", pathProgramId: null,
  pathKeySnapshot: null, prerequisiteMissionId: null, prerequisiteCodeSnapshot: null };
const env = { APP_ENV: "staging" } as HoMissionWriteEnv;
const headers = { host: HO_STAGING_HOSTNAME, origin: "https://" + HO_STAGING_HOSTNAME,
  "content-type": "application/json", "idempotency-key": "pap1207-mission-test" };
function request(method: string, body: unknown = valid, suffix = "", override: Record<string,string> = {}) {
  return new Request("https://" + HO_STAGING_HOSTNAME + path + suffix, {
    method, headers: { ...headers, ...override }, body: JSON.stringify(body),
  });
}
test("PAP-1207: narrow HO staging-only POST/PUT path; BO/TOS/Production denied", () => {
  assert.equal(decideHostBoundary(HO_STAGING_HOSTNAME, path, "POST").action, "next");
  assert.equal(decideHostBoundary(HO_STAGING_HOSTNAME, path + "/" + validId, "PUT").action, "next");
  for (const method of ["GET", "PATCH", "PUT", "DELETE", "HEAD"])
    assert.equal(decideHostBoundary(HO_STAGING_HOSTNAME, path, method).action, "not_found", method);
  for (const method of ["GET", "PATCH", "POST", "DELETE", "HEAD"])
    assert.equal(decideHostBoundary(HO_STAGING_HOSTNAME, path + "/" + validId, method).action, "not_found", method);
  for (const host of ["ho.pinohouse.art", "bo.staging.pinohouse.art", "tos.staging.pinohouse.art", "localhost",
    "pino-team-os-staging.minhtri-van42.workers.dev"]) {
    assert.equal(decideHostBoundary(host, path, "POST").action, "not_found", host);
    assert.equal(decideHostBoundary(host, path + "/" + validId, "PUT").action, "not_found", host);
  }
  assert.equal(decideHostBoundary(HO_STAGING_HOSTNAME, path + "/not-uuid", "PUT").action, "not_found");
  assert.equal(decideHostBoundary(HO_STAGING_HOSTNAME, path + "/" + validId + "/delete", "PUT").action, "not_found");
  const page = readFileSync("app/ho/learning/missions/HoMissionsTdd.tsx", "utf8");
  assert.doesNotMatch(page, /onClick=\{.*createMission|\/api\/ho\/learning\/missions/);
});
test("PAP-1207: Create and Archive via versioned PUT validate exact Core contract", () => {
  const create = parseHoMissionCommand(valid, "POST");
  assert.deepEqual(create, { ...valid, code: "MORI-1" });
  assert.deepEqual(parseHoMissionCommand({ ...valid, status: "INACTIVE", expectedVersion: 3 }, "PUT"),
    { ...valid, code: "MORI-1", status: "INACTIVE", expectedVersion: 3 });
  for (const bad of [{...valid, studentId: validId },{...valid, status: "DONE"},
    { ...valid, code:"!" }, { ...valid, name:"" }, { ...valid, level:0 },
    { ...valid, level:6 }, { ...valid, plsValue: -1 }, { ...valid, plsValue: 1.2 },
    { ...valid, paperSize:"A1" }, { ...valid, description:"x".repeat(4001) },
    { ...valid, pathProgramId:"not-an-id" }, { ...valid, prerequisiteMissionId:"not-an-id" }, null])
    assert.equal(parseHoMissionCommand(bad, "POST"), null);
  assert.equal(parseHoMissionCommand({ ...valid, expectedVersion:1 }, "POST"), null);
  assert.equal(parseHoMissionCommand({ ...valid }, "PUT"), null);
  assert.equal(parseHoMissionCommand({ ...valid, expectedVersion: 0 }, "PUT"), null);
});
test("PAP-1207: bad host, origin, payload, idempotency and absent Founder auth never call Core", async () => {
  let calls = 0;
  const wrapped = { ...env, PINO_CORE: { async executeWithStaffPassword() {
    calls++; return { status:201, body:{data:valid}, requestId:"r1" };
  } } } as HoMissionWriteEnv;
  assert.equal((await handleHoMissionWrite(request("POST"), { ...wrapped, APP_ENV: "production" })).status,404);
  assert.equal((await handleHoMissionWrite(request("POST",valid,"", { origin: "https://evil.invalid" }), wrapped)).status,403);
  assert.equal((await handleHoMissionWrite(request("POST",valid,"", { "idempotency-key":"" }), wrapped)).status,400);
  assert.equal((await handleHoMissionWrite(request("POST", {...valid, centerId:validId}), wrapped)).status,400);
  assert.ok([401,403].includes((await handleHoMissionWrite(request("PUT", {...valid,expectedVersion:1}),wrapped,validId)).status));
  assert.ok([401,403].includes((await handleHoMissionWrite(request("POST", valid), wrapped)).status));
  assert.equal((await handleHoMissionWrite(request("POST", valid,"?unexpected=1"), wrapped)).status,404);
  assert.equal((await handleHoMissionWrite(request("PUT", {...valid,expectedVersion:1}),wrapped,"invalid")).status,404);
  assert.equal(calls,0);
});
