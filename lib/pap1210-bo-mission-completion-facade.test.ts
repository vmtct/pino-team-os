import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { BoAccessCoreBinding, BoAccessRequest } from "./bo-core";
import {
  handleBoMissionCompletionRequest, isBoMissionCompletionPath,
  type BoMissionCompletionEnv,
} from "./bo-mission-completion-facade";

const id = "01a1bdfc-808f-7e7c-8833-2831bb891456";
const center = "01a0b29a-3acd-7a18-a0f2-cf6016548ab5";
const base = "learning/mission-assignments/" + id;
const session = "staff-session-fixture";
const root = "https://bo.staging.pinohouse.art/api/bo/";
const cookie = { cookie: "pino_staff_password_session=" + session };
const key = "pap1210-reopen-api-20261109-001";
const source = readFileSync(new URL("../app/api/bo/[...path]/route.ts", import.meta.url), "utf8");

function env(call: (request: BoAccessRequest, token: string) => Promise<{ status: number; body: unknown; requestId: string }>): BoMissionCompletionEnv {
  return {
    APP_ENV: "staging",
    PINO_BO_CORE: { executeWithStaffPassword: call } as BoAccessCoreBinding,
  };
}
const req = (path: string, init: RequestInit = {}) => new Request(root + path, init);

test("PAP-1210: only exact Completion routes and methods routed, no general Assignment writer", () => {
  for (const segment of ["execution", "completion-history", "reopen"]) {
    assert.equal(isBoMissionCompletionPath(base + "/" + segment), true);
  }
  for (const path of [base, "learning/mission-assignments", base + "/cancel", base + "/context",
    "learning/mission-assignments/invalid/reopen", base + "/execution/more"]) {
    assert.equal(isBoMissionCompletionPath(path), false);
  }
  assert.match(source, /isBoMissionCompletionPath\(joined\)/);
  assert.match(source, /handleBoMissionCompletionRequest\(request, env, joined\)/);
});

test("PAP-1210: GET Execution/History forward exact Center and pagination as query, never body", async () => {
  const calls: BoAccessRequest[] = [];
  const binding = env(async (call, token) => {
    assert.equal(token, session);
    calls.push(call);
    return { status: 200, body: { data: [] }, requestId: "core-read" };
  });
  const urls = [
    base + "/execution?centerId=" + center,
    base + "/completion-history?centerId=" + center + "&limit=100&offset=0",
  ];
  for (const url of urls) {
    const response = await handleBoMissionCompletionRequest(req(url, { headers: cookie }), binding, url.split("?")[0]!);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-request-id"), "core-read");
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
  assert.deepEqual(calls.map(c => c.path), urls);
  assert.ok(calls.every(c => c.method === "GET" && c.body === undefined
    && c.resource?.centerId === center));
});

test("PAP-1210: scoped Manager Reopen forwards only JSON CAS/reason, idempotency and server-derived credential", async () => {
  const calls: BoAccessRequest[] = [];
  const binding = env(async (call, token) => {
    assert.equal(token, session);
    calls.push(call);
    return { status: 200, body: { data: { executionStatus: "IN_PROGRESS", executionVersion: 2 } }, requestId: "core-write" };
  });
  const payload = { centerId: center, expectedVersion: 1, reason: "Chưa đủ chứng cứ hoàn thành bài tập" };
  const response = await handleBoMissionCompletionRequest(req(base + "/reopen", {
    method: "POST", headers: { ...cookie, origin: "https://bo.staging.pinohouse.art",
      "content-type": "application/json", "idempotency-key": key },
    body: JSON.stringify(payload),
  }), binding, base + "/reopen");
  assert.equal(response.status, 200);
  assert.deepEqual(calls, [{ method: "POST", path: base + "/reopen",
    resource: { centerId: center }, body: payload, idempotencyKey: key }]);
});

test("PAP-1210: BFF rejects malformed, duplicate, extra Center, invalid history paging and write forgery before Core", async () => {
  let calls = 0;
  const binding = env(async () => { calls++; return { status: 200, body: {}, requestId: "unexpected" }; });
  const badGet = [
    base + "/execution", base + "/execution?centerId=" + center + "&centerId=" + center,
    base + "/execution?centerId=" + center + "&actorUserId=forged",
    base + "/completion-history?centerId=" + center + "&limit=101",
    base + "/completion-history?centerId=" + center + "&offset=-1",
  ];
  for (const path of badGet) {
    const response = await handleBoMissionCompletionRequest(req(path, { headers: cookie }), binding, path.split("?")[0]!);
    assert.equal(response.status, 400, path);
  }
  const invalidWrite = [
    [{ ...cookie, "content-type": "application/json", "idempotency-key": key }, { centerId: center, expectedVersion: 1, reason: "Reason long enough" }, 403],
    [{ ...cookie, origin: "https://bo.staging.pinohouse.art", "content-type": "application/json" }, { centerId: center, expectedVersion: 1, reason: "Reason long enough" }, 400],
    [{ ...cookie, origin: "https://bo.staging.pinohouse.art", "content-type": "application/json", "idempotency-key": key }, { centerId: center, expectedVersion: 1, reason: "short" }, 400],
    [{ ...cookie, origin: "https://bo.staging.pinohouse.art", "content-type": "application/json", "idempotency-key": key }, { centerId: center, expectedVersion: 1, reason: "Reason long enough", actorUserId: id }, 400],
  ] as const;
  for (const [headers, body, status] of invalidWrite) {
    const response = await handleBoMissionCompletionRequest(req(base + "/reopen", {
      method: "POST", headers, body: JSON.stringify(body),
    }), binding, base + "/reopen");
    assert.equal(response.status, status);
  }
  assert.equal(calls, 0);
});

test("PAP-1210: no production, HO or anonymous cross-surface admission; Core ACL status preserved", async () => {
  let calls = 0;
  const binding = env(async () => { calls++; return { status: 403, body: { error: { code: "ACCESS_PERMISSION_DENIED" } }, requestId: "core-deny" }; });
  const valid = base + "/execution?centerId=" + center;
  const denied = await handleBoMissionCompletionRequest(req(valid, { headers: cookie }), binding, base + "/execution");
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get("x-request-id"), "core-deny");
  assert.equal(calls, 1);
  const off = { ...binding, APP_ENV: "production" };
  assert.equal((await handleBoMissionCompletionRequest(req(valid, { headers: cookie }), off, base + "/execution")).status, 404);
  const ho = new Request("https://ho.staging.pinohouse.art/api/bo/" + valid, { headers: cookie });
  assert.equal((await handleBoMissionCompletionRequest(ho, binding, base + "/execution")).status, 404);
  const anonymous = await handleBoMissionCompletionRequest(req(valid), binding, base + "/execution");
  assert.equal(anonymous.status, 401);
  assert.equal(calls, 1);
});
