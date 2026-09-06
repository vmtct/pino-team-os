import test from "node:test";
import assert from "node:assert/strict";
import { handleBoWorkforcePlanningRequest, type BoWorkforcePlanningEnv, type WorkforcePlanningCoreBinding, type WorkforcePlanningRequest } from "./bo-workforce-planning-handler";

const session = "local-session-token";
function env(binding: WorkforcePlanningCoreBinding): BoWorkforcePlanningEnv { return { PINO_WORKFORCE_CORE: binding }; }
function headers(extra: Record<string,string> = {}) { return { cookie: `pino_staff_password_session=${session}`, ...extra }; }
function binding(operation: (request: WorkforcePlanningRequest, token: string) => Promise<{ status: number; body: unknown; requestId: string }>): WorkforcePlanningCoreBinding {
  return { executePlanningWithStaffPassword: operation };
}

test("BO weekly planner forwards bounded query through local password session", async () => {
  let forwarded: WorkforcePlanningRequest | undefined, token = "";
  const response = await handleBoWorkforcePlanningRequest(new Request("https://bo.pinohouse.art/api/bo/workforce/planning/weekly?centerId=center-1&termWeekId=week-1&userId=forged", { headers: headers() }), env(binding(async (request, value) => {
    forwarded = request; token = value; return { status: 200, body: { data: { staff: [] } }, requestId: "core-weekly" };
  })), "workforce/planning/weekly");
  assert.equal(response.status, 200); assert.equal(response.headers.get("x-request-id"), "core-weekly");
  assert.deepEqual(forwarded, { method: "GET", path: "weekly", body: { centerId: "center-1", termWeekId: "week-1" } }); assert.equal(token, session);
});
test("assignment and cancellation forward exact idempotency keys", async () => {
  const forwarded: WorkforcePlanningRequest[] = [];
  const b = binding(async request => { forwarded.push(request); return { status: 200, body: { data: { id: "assignment" } }, requestId: "core-write" }; });
  const assignmentBody = { staffMemberId: "staff", centerId: "center", workDate: "2026-09-01", shiftTemplateId: "shift", termWeekId: "week" };
  const create = new Request("https://bo.pinohouse.art/api/bo/workforce/planning/assignment", { method: "POST", headers: headers({ "content-type": "application/json", "idempotency-key": "create-key" }), body: JSON.stringify(assignmentBody) });
  const cancel = new Request("https://bo.pinohouse.art/api/bo/workforce/planning/assignment/cancel", { method: "POST", headers: headers({ "content-type": "application/json", "idempotency-key": "cancel-key" }), body: JSON.stringify({ assignmentId: "assignment", reason: "Correction" }) });
  assert.equal((await handleBoWorkforcePlanningRequest(create, env(b), "workforce/planning/assignment")).status, 200);
  assert.equal((await handleBoWorkforcePlanningRequest(cancel, env(b), "workforce/planning/assignment/cancel")).status, 200);
  assert.deepEqual(forwarded, [{ method: "POST", path: "assignment", body: assignmentBody, idempotencyKey: "create-key" }, { method: "POST", path: "assignment/cancel", body: { assignmentId: "assignment", reason: "Correction" }, idempotencyKey: "cancel-key" }]);
});

test("missing mutation replay key and missing password session fail before Core", async () => {
  let called = false; const b = binding(async () => { called = true; throw new Error("unexpected"); });
  const noKey = new Request("https://bo.pinohouse.art/api/bo/workforce/planning/assignment", { method: "POST", headers: headers({ "content-type": "application/json" }), body: "{}" });
  const noIdentity = new Request("https://bo.pinohouse.art/api/bo/workforce/planning/weekly?centerId=c&termWeekId=w");
  assert.equal((await handleBoWorkforcePlanningRequest(noKey, env(b), "workforce/planning/assignment")).status, 400);
  assert.equal((await handleBoWorkforcePlanningRequest(noIdentity, env(b), "workforce/planning/weekly")).status, 401);
  assert.equal(called, false);
});

test("unknown routes and wrong methods fail closed before Core", async () => {
  let called = false; const b = binding(async () => { called = true; throw new Error("unexpected"); });
  const unknown = new Request("https://bo.pinohouse.art/api/bo/workforce/planning/templates", { headers: headers() });
  const wrongMethod = new Request("https://bo.pinohouse.art/api/bo/workforce/planning/weekly", { method: "PUT", headers: headers() });
  assert.equal((await handleBoWorkforcePlanningRequest(unknown, env(b), "workforce/planning/templates")).status, 404);
  assert.equal((await handleBoWorkforcePlanningRequest(wrongMethod, env(b), "workforce/planning/weekly")).status, 405);
  assert.equal(called, false);
});
test("Core authorization denial and request ID pass through unchanged", async () => {
  const b = binding(async () => ({ status: 403, body: { error: { code: "ACCESS_PERMISSION_DENIED" } }, requestId: "core-denied" }));
  const request = new Request("https://bo.pinohouse.art/api/bo/workforce/planning/weekly?centerId=c&termWeekId=w", { headers: headers() });
  const response = await handleBoWorkforcePlanningRequest(request, env(b), "workforce/planning/weekly");
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("x-request-id"), "core-denied");
});

test("workers.dev staging flags cannot substitute a human Workforce planner identity", async () => {
  let called = false;
  const stagingEnv: BoWorkforcePlanningEnv = { ...env(binding(async () => { called = true; throw new Error("unexpected"); })), };
  const staging = new Request("https://pino-team-os-staging.minhtri-van42.workers.dev/api/bo/workforce/planning/weekly?centerId=c&termWeekId=w");
  assert.equal((await handleBoWorkforcePlanningRequest(staging, stagingEnv, "workforce/planning/weekly")).status, 401);
  assert.equal(called, false);
});

test("check-in exception queue/detail forward bounded reads without forged target authority", async () => {
  const forwarded: WorkforcePlanningRequest[] = [];
  const b = binding(async request => { forwarded.push(request); return { status: 200, body: { data: [] }, requestId: "exc-read" }; });
  const list = new Request("https://bo.pinohouse.art/api/bo/workforce/planning/check-in-exceptions?centerId=center-1&status=REQUESTED&staffMemberId=forged&workDate=2099-01-01", { headers: headers() });
  const detailId = "01999999-9999-7999-8999-999999999999";
  const detail = new Request(`https://bo.pinohouse.art/api/bo/workforce/planning/check-in-exceptions/${detailId}?centerId=forged`, { headers: headers() });
  assert.equal((await handleBoWorkforcePlanningRequest(list, env(b), "workforce/planning/check-in-exceptions")).status, 200);
  assert.equal((await handleBoWorkforcePlanningRequest(detail, env(b), `workforce/planning/check-in-exceptions/${detailId}`)).status, 200);
  assert.deepEqual(forwarded, [
    { method: "GET", path: "check-in-exceptions", body: { centerId: "center-1", status: "REQUESTED" } },
    { method: "GET", path: `check-in-exceptions/${detailId}`, body: {} },
  ]);
});

test("check-in exception approve/decline preserve replay evidence and never forward browser-selected staff/date", async () => {
  const forwarded: WorkforcePlanningRequest[] = [];
  const b = binding(async request => { forwarded.push(request); return { status: 200, body: { data: { status: "REQUESTED" } }, requestId: "exc-write" }; });
  const id = "01999999-9999-7999-8999-999999999999";
  const approve = new Request(`https://bo.pinohouse.art/api/bo/workforce/planning/check-in-exceptions/${id}/approve`, { method: "POST", headers: headers({ "content-type": "application/json", "idempotency-key": "approve-key" }), body: JSON.stringify({ expectedVersion: 3 }) });
  const decline = new Request(`https://bo.pinohouse.art/api/bo/workforce/planning/check-in-exceptions/${id}/decline`, { method: "POST", headers: headers({ "content-type": "application/json", "idempotency-key": "decline-key" }), body: JSON.stringify({ expectedVersion: 3, reason: "No coverage need" }) });
  assert.equal((await handleBoWorkforcePlanningRequest(approve, env(b), `workforce/planning/check-in-exceptions/${id}/approve`)).status, 200);
  assert.equal((await handleBoWorkforcePlanningRequest(decline, env(b), `workforce/planning/check-in-exceptions/${id}/decline`)).status, 200);
  assert.deepEqual(forwarded, [
    { method: "POST", path: `check-in-exceptions/${id}/approve`, body: { expectedVersion: 3 }, idempotencyKey: "approve-key" },
    { method: "POST", path: `check-in-exceptions/${id}/decline`, body: { expectedVersion: 3, reason: "No coverage need" }, idempotencyKey: "decline-key" },
  ]);
});
