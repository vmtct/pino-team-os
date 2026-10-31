import test from "node:test";
import assert from "node:assert/strict";
import { loadMissionForEdit } from "../app/ho/learning/missions/read-edit";
import { submitHoMission, type MissionInput } from "../app/ho/learning/missions/command";
const id = "01900000-0000-7000-8000-000000000002";
const input: MissionInput = { code: "MORI-1", name: "Mori", level: 1,
  status: "ACTIVE", plsValue: 20, paperSize: "A4", description: null, guideline: null,
  pathProgramId: null, pathKeySnapshot: null, prerequisiteMissionId: null, prerequisiteCodeSnapshot: null };
const response = (data: unknown, status = 200) => Response.json({ data }, { status });
test("PAP-1207: Edit reads real Founder HO record/version before showing form", async () => {
  const calls: string[] = [];
  const f: typeof fetch = async (url, init) => {
    calls.push(String(init?.method) + " " + String(url));
    return response({ ...input, id, version: 3 });
  };
  const outcome = await loadMissionForEdit(id, f);
  assert.deepEqual(outcome, { state: "ready", id, version: 3, data: input });
  assert.deepEqual(calls, ["GET /api/ho/learning/missions/" + id]);
});
test("PAP-1207: denied, invalid version and network error never open stale Edit", async () => {
  assert.equal((await loadMissionForEdit("not-id", async () => { throw Error("must not fetch"); })).state, "unavailable");
  for (const status of [401, 403, 404]) {
    assert.equal((await loadMissionForEdit(id, async () => response(null, status))).state, "denied");
  }
  for (const row of [{ ...input, id, version: 0 }, { ...input, id, version: "3" },
    { ...input, id, version: 3, status: "DONE" }, { ...input, id: "wrong", version: 3 }]) {
    assert.equal((await loadMissionForEdit(id, async () => response(row))).state, "unavailable");
  }
  assert.equal((await loadMissionForEdit(id, async () => { throw Error("offline"); })).state, "unavailable");
});
test("PAP-1207: Edit uses optimistic version and exact readback, never blind retry", async () => {
  const calls: string[] = [];
  const f: typeof fetch = async (url, init) => {
    calls.push(String(init?.method) + " " + String(url));
    if (init?.method === "PUT") {
      assert.deepEqual(JSON.parse(String(init.body)), { ...input, name: "Mori updated", expectedVersion: 3 });
      return response({ ...input, name: "Mori updated", id, version: 4 });
    }
    return response({ ...input, name: "Mori updated", id, version: 4 });
  };
  const outcome = await submitHoMission({
    kind: "update", id, expectedVersion: 3, data: { ...input, name: "Mori updated" },
    idempotencyKey: "mission-edit-pap1207-1234",
  }, f);
  assert.equal(outcome.state, "verified");
  assert.deepEqual(calls, ["PUT /api/ho/learning/missions/" + id, "GET /api/ho/learning/missions/" + id]);
});
