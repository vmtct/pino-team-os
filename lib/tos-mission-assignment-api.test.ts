import test from "node:test";
import assert from "node:assert/strict";
import {
  TosMissionAssignmentApiError,
  createTosMissionAssignmentApiTransport,
  tosMissionAssignmentApi,
  type TosMissionAssignmentScope,
} from "./tos-mission-assignment-api";

/** PAP-1488, Epic PAP-1188: contract-only; never writes Core from this test. */
const ids = {
  centerId: "11111111-1111-4111-8111-111111111111",
  studentId: "22222222-2222-4222-8222-222222222222",
  runningClassId: "33333333-3333-4333-8333-333333333333",
  missionId: "44444444-4444-4444-8444-444444444444",
  assignmentId: "55555555-5555-4555-8555-555555555555",
};
const scope: TosMissionAssignmentScope = {
  centerId: ids.centerId, studentId: ids.studentId, runningClassId: ids.runningClassId,
  localDate: "2026-11-05", teachingContextKey: ids.runningClassId + ":2026-11-05",
};
const record = {
  id: ids.assignmentId, centerId: ids.centerId, studentId: ids.studentId, missionId: ids.missionId,
  missionCodeSnapshot: "ART-101", missionNameSnapshot: "Nét đầu tiên",
  contextKey: scope.teachingContextKey, contextLabel: null, status: "ASSIGNED" as const,
  assignedAt: "2026-11-05T09:00:00Z", assignedByUserId: ids.studentId,
  updatedAt: "2026-11-05T09:00:00Z", updatedByUserId: ids.studentId,
  cancelledAt: null, cancelledReason: null, version: 1,
};

test("default singleton is fail-closed: no Assignment writes without integration admission", async () => {
  await assert.rejects(
    tosMissionAssignmentApi.create({ ...scope, missionId: ids.missionId }, "do-not-write"),
    (error: unknown) => error instanceof TosMissionAssignmentApiError && error.status === 503 &&
      error.code === "TOS_MISSION_ASSIGNMENT_WRITE_NOT_ADMITTED",
  );
});

test("GET list and detail send explicit student+center+class+day scope and no cache", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const api = createTosMissionAssignmentApiTransport(false, async (url, init) => {
    calls.push({ url: String(url), init: init ?? {} });
    return Response.json({ data: calls.length === 1 ? [record] : record });
  });
  const rows = await api.list({ ...scope, status: "ASSIGNED", limit: 20, offset: 0 });
  const detail = await api.get(scope, ids.assignmentId);
  assert.equal(rows.length, 1);
  assert.equal(detail.id, ids.assignmentId); // transport reads Core canonical ID unchanged
  assert.equal(calls.length, 2);
  const url = new URL(calls[0]!.url, "https://team.invalid");
  assert.equal(url.pathname, "/api/tos-learning/learning/mission-assignments");
  for (const [key, value] of Object.entries(scope)) assert.equal(url.searchParams.get(key), value);
  assert.equal(url.searchParams.get("status"), "ASSIGNED");
  assert.equal(url.searchParams.get("limit"), "20");
  assert.equal(url.searchParams.get("offset"), "0");
  assert.equal(calls[0]!.init.cache, "no-store");
  assert.equal(calls[0]!.init.method, "GET");
  assert.ok(calls[1]!.url.includes("/" + ids.assignmentId + "?"));
});

test("explicit admitted create/update/cancel retain separate Core source ID, versions, idempotency, reason", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const api = createTosMissionAssignmentApiTransport(true, async (url, init) => {
    calls.push({ url: String(url), init: init ?? {} });
    return Response.json({ data: record }, { status: calls.length === 1 ? 201 : 200 });
  });
  await api.create({ ...scope, missionId: ids.missionId, contextLabel: null }, "create-001");
  await api.updateContext(scope, ids.assignmentId, { expectedVersion: 1, contextLabel: "Ôn luyện" }, "edit-002");
  await api.cancel(scope, ids.assignmentId, { expectedVersion: 2, reason: "Thay đổi mục tiêu" }, "cancel-003");
  assert.deepEqual(calls.map(({ init }) => init.method), ["POST", "PUT", "POST"]);
  assert.deepEqual(calls.map(({ init }) => new Headers(init.headers).get("idempotency-key")),
    ["create-001", "edit-002", "cancel-003"]);
  assert.deepEqual(JSON.parse(String(calls[0]!.init.body)), {
    ...scope, missionId: ids.missionId, expectedVersion: 0, contextLabel: null,
  });
  assert.deepEqual(JSON.parse(String(calls[1]!.init.body)), {
    ...scope, expectedVersion: 1, contextLabel: "Ôn luyện",
  });
  assert.deepEqual(JSON.parse(String(calls[2]!.init.body)), {
    ...scope, expectedVersion: 2, reason: "Thay đổi mục tiêu",
  });
  assert.ok(calls[1]!.url.endsWith("/" + ids.assignmentId + "/context"));
  assert.ok(calls[2]!.url.endsWith("/" + ids.assignmentId + "/cancel"));
  assert.ok(calls.every(({ init }) => init.cache === "no-store"));
});

test("reject mismatched occurrence, invalid date, version, reason, missing replay key before transport", async () => {
  let calls = 0;
  const api = createTosMissionAssignmentApiTransport(true, async () => {
    calls++;
    return Response.json({ data: record });
  });
  const bad = async (task: () => Promise<unknown>) =>
    assert.rejects(task, (error: unknown) => error instanceof TosMissionAssignmentApiError && error.status === 400);
  await bad(() => api.list({ ...scope, teachingContextKey: "wrong" }));
  await bad(() => api.list({ ...scope, localDate: "2026-02-30" }));
  await bad(() => api.create({ ...scope, missionId: ids.missionId }, " "));
  await bad(() => api.updateContext(scope, ids.assignmentId, { expectedVersion: 0, contextLabel: null }, "edit"));
  await bad(() => api.cancel(scope, ids.assignmentId, { expectedVersion: 1, reason: "  " }, "cancel"));
  await bad(() => api.get(scope, "not-an-assignment"));
  await bad(() => api.list({ ...scope, limit: 200 }));
  assert.equal(calls, 0);
});

test("server 403 and 409 propagate as typed errors without retry or authority bypass", async () => {
  for (const [status, code] of [[403, "ACCESS_PERMISSION_DENIED"], [409, "MISSION_ASSIGNMENT_VERSION_CONFLICT"]] as const) {
    let calls = 0;
    const api = createTosMissionAssignmentApiTransport(true, async () => {
      calls++;
      return Response.json({ error: { code, message: code } }, { status });
    });
    await assert.rejects(
      api.updateContext(scope, ids.assignmentId, { expectedVersion: 1, contextLabel: null }, "edit-123"),
      (error: unknown) => error instanceof TosMissionAssignmentApiError &&
        error.status === status && error.code === code,
    );
    assert.equal(calls, 1);
  }
});

test("malformed successful Core envelope fails closed instead of inventing Assignment", async () => {
  const api = createTosMissionAssignmentApiTransport(false, async () => Response.json({ success: true }));
  await assert.rejects(
    api.list(scope),
    (error: unknown) => error instanceof TosMissionAssignmentApiError &&
      error.code === "MISSION_ASSIGNMENT_INVALID_RESPONSE",
  );
});
