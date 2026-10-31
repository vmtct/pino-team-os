import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { submitHoMission, type MissionInput } from "../app/ho/learning/missions/command";
const id = "01900000-0000-7000-8000-000000000002";
const valid: MissionInput = {
  code: "MORI-1", name: "Mori", level: 2, status: "ACTIVE", plsValue: 25,
  paperSize: "A4", description: null, guideline: null, pathProgramId: null,
  pathKeySnapshot: null, prerequisiteMissionId: null, prerequisiteCodeSnapshot: null,
};
const key = "pap1207-command-20261031";
const command = { kind: "create", data: valid, idempotencyKey: key } as const;
const response = (data: unknown, status = 200) => Response.json({ data }, { status });
test("PAP-1207: command adapter is headless; never forks engine action placement", () => {
  const code = readFileSync("app/ho/learning/missions/command.ts", "utf8");
  assert.doesNotMatch(code, /<button|localStorage|sessionStorage|onClick=|actionHost|window\./);
  const ui = readFileSync("app/ho/learning/missions/HoMissionsTdd.tsx", "utf8");
  assert.match(ui, /missionWriteUnavailable/);
});
test("PAP-1207: Create confirms exact Core POST receipt and authorized GET readback", async () => {
  const requests: { url: string; method: string; headers: Headers; body?: string }[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    requests.push({ url: String(url), method: String(init?.method), headers: new Headers(init?.headers),
      body: typeof init?.body === "string" ? init.body : undefined });
    return init?.method === "POST"
      ? response({ ...valid, id, version: 1 }, 201) : response({ ...valid, id, version: 1 });
  };
  const outcome = await submitHoMission(command, fetcher);
  assert.deepEqual(outcome, { state: "verified", record: { id, code: valid.code, status: "ACTIVE", version: 1 } });
  assert.equal(requests.length, 2);
  assert.equal(requests[0]?.url, "/api/ho/learning/missions");
  assert.equal(requests[0]?.method, "POST");
  assert.equal(requests[0]?.headers.get("idempotency-key"), key);
  assert.equal(requests[0]?.headers.get("content-type"), "application/json");
  assert.deepEqual(JSON.parse(requests[0]!.body!), valid);
  assert.equal(requests[1]?.url, "/api/ho/learning/missions/" + id);
  assert.equal(requests[1]?.method, "GET");
});
test("PAP-1207: Update/Archive include strict version, Archive only via INACTIVE", async () => {
  for (const kind of ["update", "archive"] as const) {
    const status = kind === "archive" ? "INACTIVE" : "ACTIVE";
    const calls: string[] = [];
    const f: typeof fetch = async (url, init) => {
      calls.push(String(url) + " " + String(init?.method));
      if (init?.method === "PUT") {
        assert.deepEqual(JSON.parse(String(init.body)), { ...valid, status, expectedVersion: 3 });
        return response({ ...valid, id, status, version: 4 });
      }
      return response({ ...valid, id, status, version: 4 });
    };
    const result = await submitHoMission({ kind, id, expectedVersion: 3, data: valid, idempotencyKey: key }, f);
    assert.equal(result.state, "verified");
    assert.deepEqual(calls, ["/api/ho/learning/missions/" + id + " PUT",
      "/api/ho/learning/missions/" + id + " GET"]);
  }
});
test("PAP-1207: denial, duplicate/CAS conflict, invalid, offline and unverified never auto-retry", async () => {
  for (const [status, state] of [[401, "denied"], [403, "denied"], [404, "denied"],
    [409, "conflict"], [400, "invalid"], [503, "unverified"]] as const) {
    let count = 0;
    const f: typeof fetch = async () => { count++; return response({ error: "x" }, status); };
    const result = await submitHoMission(command, f);
    assert.equal(result.state, state);
    assert.equal(count, 1);
  }
  const network: typeof fetch = async () => { throw Error("network disconnect"); };
  assert.equal((await submitHoMission(command, network)).state, "unverified");
  let calls = 0;
  const f: typeof fetch = async (url, init) => {
    calls++;
    return init?.method === "POST"
      ? response({ ...valid, id, version: 1 }, 201)
      : response({ ...valid, id, version: 1, status: "INACTIVE" });
  };
  const stale = await submitHoMission(command, f);
  assert.equal(stale.state, "unverified");
  assert.equal(calls, 2);
  assert.equal("recordId" in stale && stale.recordId, id);
});
test("PAP-1207: inconsistent receipt/identity/version do not claim success", async () => {
  for (const raw of [{ ...valid, id: "bad", version: 1 },
    { ...valid, id, version: 1, status: "INACTIVE" },
    { ...valid, id, version: "1" }]) {
    const f: typeof fetch = async () => response(raw, 201);
    assert.equal((await submitHoMission(command, f)).state, "unverified");
  }
  const badVersion = await submitHoMission(
    { kind: "update", id, expectedVersion: 3, data: valid, idempotencyKey: key },
    async () => response({ ...valid, id, version: 3 }));
  assert.equal(badVersion.state, "unverified");
  assert.equal((await submitHoMission({ ...command, idempotencyKey: "" }, async () => {
    throw Error("SHOULD_NOT_SEND");
  })).state, "invalid");
});
