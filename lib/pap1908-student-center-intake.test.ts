// PAP-1908 — BO Student Center-scoped intake BFF/client contract, Epic SCH-STUDENT-MGMT.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { handleBoOperationalReadRequest, type BoReadEnv } from "./bo-read-handler";
import { handleBoWriteRequest, type BoWriteEnv } from "./bo-write-handler";
import { boApi, BoApiError, type BoStudentIntakeCreateInput } from "./bo-api";
import type { BoAccessCoreBinding, BoAccessRequest } from "./bo-core";
const center = "0198d050-56c1-7ac5-b9ab-b0e45d912345";
const otherCenter = "0198d050-56c1-7ac5-b9ab-b0e45d954321";
const token = "pap1908-password-session";
const path = "student-intakes/center", search = "identity/parents/center-search";
const data: BoStudentIntakeCreateInput = {
  displayName: "Student Fixture", birthYear: 2019, birthMonth: 5, birthDay: 7,
  birthPrecision: "FULL_DATE", relationshipType: "PARENT", effectiveFrom: "2026-11-12T05:00:00.000Z",
  existingParentUserId: "0198d050-56c1-7ac5-b9ab-b0e45d900001",
};
const result = {
  studentProfileId: "0198d050-56c1-7ac5-b9ab-b0e45d900002",
  parentUserId: "0198d050-56c1-7ac5-b9ab-b0e45d900001",
  guardianRelationshipId: "0198d050-56c1-7ac5-b9ab-b0e45d900003",
  parentReused: true,
};
const env = (binding: BoAccessCoreBinding): BoReadEnv & BoWriteEnv => ({ PINO_BO_CORE: binding });
const post = (suffix = "?centerId=" + center, body: unknown = data, key = "pap1908-one", auth = true) =>
  new Request("https://bo.pinohouse.art/api/bo/" + path + suffix, {
    method: "POST", headers: { "content-type": "application/json", ...(key ? { "idempotency-key": key } : {}),
      ...(auth ? { cookie: "pino_staff_password_session=" + token } : {}) },
    body: JSON.stringify(body),
  });
const get = (query: string, auth = true) => new Request(
  "https://bo.pinohouse.art/api/bo/" + search + query,
  { headers: auth ? { cookie: "pino_staff_password_session=" + token } : {} },
);

test("PAP-1908 selected Center Parent picker forwards only its resource and bounded filters", async () => {
  const forwarded: BoAccessRequest[] = [];
  const binding: BoAccessCoreBinding = { async executeWithStaffPassword(request, credential) {
    assert.equal(credential, token); forwarded.push(request);
    return { status: 200, body: { data: [] }, requestId: "read-center" };
  } };
  const response = await handleBoOperationalReadRequest(get("?centerId=" + center + "&query=Mai&limit=20"), env(binding), search);
  assert.equal(response.status, 200); assert.equal(response.headers.get("x-request-id"), "read-center");
  assert.deepEqual(forwarded, [{ method: "GET", path: search, resource: { centerId: center }, body: { query: "Mai", limit: 20 } }]);
});

test("PAP-1908 Parent picker fail-closed on unscoped, duplicate, out-of-bounds, or forged principal", async () => {
  let calls = 0;
  const binding: BoAccessCoreBinding = { async executeWithStaffPassword() { calls++; return { status: 200, body: { data: [] }, requestId: "unexpected" }; } };
  const invalid = ["", "?query=Mai", "?centerId=forged", "?centerId=" + center + "&centerId=" + otherCenter,
    "?centerId=" + center + "&limit=0", "?centerId=" + center + "&limit=26", "?centerId=" + center + "&limit=01",
    "?centerId=" + center + "&query=A&query=B", "?centerId=" + center + "&userId=forged"];
  for (const query of invalid) assert.equal((await handleBoOperationalReadRequest(get(query), env(binding), search)).status, 400, query);
  assert.equal((await handleBoOperationalReadRequest(get("?centerId=" + center, false), env(binding), search)).status, 401);
  assert.equal(calls, 0);
});

test("PAP-1908 BFF POST conveys one selected Center with unchanged body/idempotency", async () => {
  const forwarded: BoAccessRequest[] = [];
  const binding: BoAccessCoreBinding = { async executeWithStaffPassword(request, credential) {
    assert.equal(credential, token); forwarded.push(request);
    return { status: 201, body: { data: result }, requestId: "intake-201" };
  } };
  const response = await handleBoWriteRequest(post(), env(binding), path);
  assert.equal(response.status, 201); assert.equal(response.headers.get("x-request-id"), "intake-201");
  assert.deepEqual(forwarded, [{ method: "POST", path, body: data, resource: { centerId: center }, idempotencyKey: "pap1908-one" }]);
});

test("PAP-1908 BFF refuses missing Center, duplicate Center, body-scope injection, missing key and 401", async () => {
  let calls = 0;
  const binding: BoAccessCoreBinding = { async executeWithStaffPassword() { calls++; return { status: 200, body: { data: result }, requestId: "unexpected" }; } };
  for (const request of [post(""), post("?centerId=forged"), post("?centerId=" + center + "&centerId=" + otherCenter),
    post("?centerId=" + center + "&userId=forged"), post("?centerId=" + center, { ...data, centerId: otherCenter }), post("?centerId=" + center, data, ""),
  ]) assert.equal((await handleBoWriteRequest(request, env(binding), path)).status, 400);
  assert.equal((await handleBoWriteRequest(post("?centerId=" + center, data, "key", false), env(binding), path)).status, 401);
  assert.equal(calls, 0);
});

test("PAP-1908 Core 403 propagates; Founder legacy GLOBAL route remains separately callable", async () => {
  const seen: BoAccessRequest[] = [];
  const binding: BoAccessCoreBinding = { async executeWithStaffPassword(request) {
    seen.push(request);
    return request.path === path ? { status: 403, body: { error: { code: "ACCESS_PERMISSION_DENIED" } }, requestId: "denied" }
      : { status: 201, body: { data: result }, requestId: "founder" };
  } };
  const denied = await handleBoWriteRequest(post(), env(binding), path);
  assert.equal(denied.status, 403); assert.equal(denied.headers.get("x-request-id"), "denied");
  const legacy = "student-intakes";
  const legacyRequest = new Request("https://bo.pinohouse.art/api/bo/" + legacy, { method: "POST",
    headers: { cookie: "pino_staff_password_session=" + token, "idempotency-key": "founder-only", "content-type": "application/json" }, body: JSON.stringify(data) });
  assert.equal((await handleBoWriteRequest(legacyRequest, env(binding), legacy)).status, 201);
  assert.deepEqual(seen[1], { method: "POST", path: legacy, body: data, idempotencyKey: "founder-only" });
});

test("PAP-1908 BO client uses Center-only GET/POST; legacy global RPC retained", async () => {
  const original = globalThis.fetch; const seen: Array<{ path: string; init?: RequestInit }> = [];
  globalThis.fetch = async (input, init) => { seen.push({ path: String(input), init });
    return Response.json({ data: String(input).includes("center-search") ? [] : result }, { status: String(input).includes("center-search") ? 200 : 201 }); };
  try {
    assert.deepEqual(await boApi.parentsInCenter(center, "Mai", 20), []);
    assert.deepEqual(await boApi.createStudentIntakeInCenter(center, data, "replay-key"), result);
    const before = seen.length;
    assert.throws(() => boApi.parentsInCenter("", "Mai"), (e: unknown) => e instanceof BoApiError && e.status === 400);
    await assert.rejects(boApi.createStudentIntakeInCenter(otherCenter + "/x", data, "bad"), (e: unknown) => e instanceof BoApiError && e.status === 400);
    assert.equal(seen.length, before);
  } finally { globalThis.fetch = original; }
  assert.equal(seen[0]!.path, "/api/bo/identity/parents/center-search?centerId=" + center + "&limit=20&query=Mai");
  assert.equal(seen[1]!.path, "/api/bo/student-intakes/center?centerId=" + center);
  assert.equal(new Headers(seen[1]!.init?.headers).get("idempotency-key"), "replay-key");
  const studentSource = readFileSync(new URL("../app/bo/components/registration/BoStudentCreate.tsx", import.meta.url), "utf8");
  assert.match(studentSource, /useBoCenterSelection/);
  assert.match(studentSource, /BoStudentCreateScoped key=\{centerId\}/);
  assert.match(studentSource, /if \(mountedRef.current\) onCreated/);
  assert.match(studentSource, /parentsInCenter\(centerId/);
  assert.match(studentSource, /createStudentIntakeInCenter\(currentAttempt.centerId/);
  assert.match(studentSource, /attemptRef.current.centerId !== centerId/);
  assert.doesNotMatch(studentSource, /boApi\.parents\(parentQuery/);
});
