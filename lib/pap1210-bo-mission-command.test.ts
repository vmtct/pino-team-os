import test from "node:test";
import assert from "node:assert/strict";
import { submitBoMissionAssignment, type AssignmentWrite } from "./bo-mission-assignment-command";

const center = "01900000-0000-7000-8000-000000000001";
const student = "01900000-0000-7000-8000-000000000002";
const mission = "01900000-0000-7000-8000-000000000003";
const id = "01900000-0000-7000-8000-000000000004";
const actor = "01900000-0000-7000-8000-000000000005";
const assigned = { id, centerId: center, studentId: student, missionId: mission,
  missionCodeSnapshot: "QA-MISSION", missionNameSnapshot: "Source-backed Mission",
  contextKey: "", contextLabel: "Tập nét", status: "ASSIGNED",
  assignedAt: "2026-10-31T00:00:00.000Z", assignedByUserId: actor,
  updatedAt: "2026-10-31T00:00:00.000Z", updatedByUserId: actor,
  cancelledAt: null, cancelledReason: null, version: 1 };
const create: AssignmentWrite = { kind: "create", centerId: center, studentId: student,
  missionId: mission, contextLabel: "Tập nét", idempotencyKey: "pap1210-create-0001" };
const update: AssignmentWrite = { kind: "update", centerId: center, id, expectedVersion: 1,
  contextLabel: "Đã tập nét", idempotencyKey: "pap1210-update-0001" };
const cancel: AssignmentWrite = { kind: "cancel", centerId: center, id, expectedVersion: 1,
  reason: "Đổi nhiệm vụ", idempotencyKey: "pap1210-cancel-0001" };
const updated = { ...assigned, version: 2, contextLabel: "Đã tập nét" };
const cancelled = { ...assigned, version: 2, status: "CANCELLED",
  cancelledAt: "2026-10-31T01:00:00.000Z", cancelledReason: "Đổi nhiệm vụ" };
const reply = (data: unknown, status = 200) => Response.json({ data }, { status });
test("PAP-1210: Create/Update/Cancel verify exact Core receipt and GET readback", async () => {
  for (const [cmd, record, method, path, status] of [
    [create, assigned, "POST", "", 201],
    [update, updated, "PUT", "/" + id, 200],
    [cancel, cancelled, "POST", "/" + id + "/cancel", 200],
  ] as const) {
    const requests: Array<{ path: string; method: string; key: string | null; body?: unknown }> = [];
    const fetcher: typeof fetch = async (input, init) => {
      requests.push({ path: String(input), method: init?.method ?? "GET",
        key: new Headers(init?.headers).get("idempotency-key"),
        ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}) });
      return reply(record, init?.method === "GET" ? 200 : status);
    };
    const result = await submitBoMissionAssignment(cmd, fetcher);
    assert.equal(result.state, "verified");
    if (result.state === "verified") assert.deepEqual(result.record, record);
    assert.equal(requests.length, 2);
    assert.equal(requests[0]?.method, method);
    assert.equal(requests[0]?.key, cmd.idempotencyKey);
    assert.equal(requests[0]?.path, "/api/bo/learning/mission-assignments" + path + "?centerId=" + center);
    assert.deepEqual(requests[1], { path: "/api/bo/learning/mission-assignments/" + id + "?centerId=" + center,
      method: "GET", key: null });
  }
});
test("PAP-1210: negative outcomes, uncertainty and conflict do not replay writes", async () => {
  for (const status of [400, 401, 403, 404, 409, 503]) {
    let writes = 0;
    const response: typeof fetch = async () => { writes++; return reply({}, status); };
    const r = await submitBoMissionAssignment(create, response);
    assert.equal(r.state, status === 409 ? "conflict" : [401, 403, 404].includes(status) ? "denied"
      : status === 400 ? "invalid" : "unverified");
    assert.equal(writes, 1);
  }
  let attempts = 0;
  const network: typeof fetch = async () => { attempts++; throw Error("network"); };
  assert.equal((await submitBoMissionAssignment(create, network)).state, "unverified");
  assert.equal(attempts, 1);
  const wrongReceipt: typeof fetch = async () => reply({ ...assigned, centerId: student }, 201);
  assert.equal((await submitBoMissionAssignment(create, wrongReceipt)).state, "unverified");
  const wrongRead: typeof fetch = async (_, init) => reply(init?.method === "GET" ? { ...assigned, version: 2 } : assigned,
    init?.method === "GET" ? 200 : 201);
  assert.equal((await submitBoMissionAssignment(create, wrongRead)).state, "unverified");
  const deniedRead: typeof fetch = async (_, init) => init?.method === "GET" ? reply(null, 403) : reply(assigned, 201);
  assert.equal((await submitBoMissionAssignment(create, deniedRead)).state, "unverified");
});
test("PAP-1210: invalid IDs, labels, versions and idempotency never issue commands", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => { calls++; return reply(assigned, 201); };
  for (const command of [
    { ...create, centerId: "wrong" }, { ...create, missionId: "bad" },
    { ...create, idempotencyKey: "short" }, { ...create, contextLabel: "x".repeat(201) },
    { ...update, expectedVersion: 0 }, { ...update, id: "bad" },
    { ...cancel, reason: "" }, { ...cancel, expectedVersion: 1.5 },
  ] as AssignmentWrite[]) assert.equal((await submitBoMissionAssignment(command, fetcher)).state, "invalid");
  assert.equal(calls, 0);
});
