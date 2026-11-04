import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { projectMissionHistoryPage, readMissionHistory } from "./mission-history";
import { missionProvider, missionDefinition } from "@/app/ho/learning/missions/schema";
import { assignmentProvider, assignmentDefinition } from "@/app/bo/missions/schema";
import { isOperationalReadPath, handleBoOperationalReadRequest } from "./bo-read-handler";
import { handleHoMissionHistoryRead } from "./ho-mission-write-facade";
import { surfaceSession } from "./workspace-adapters/session";
import { decideHostBoundary } from "./host-boundary";

const record = "01a1a1d6-aab6-70aa-bc15-b678935d8147";
const eventId = "01a1a1d6-aab6-70aa-bc15-b678935d8148";
const center = "01a0b29a-3acd-7a18-a0f2-cf6016548ab5";
const raw = (action = "Cập nhật Mission") => ({
  id: eventId, occurredAt: "2026-11-03T14:36:13.347Z", action,
  outcome: "succeeded", actorId: null, actorLabel: null, before: null,
  after: null, description: null, redacted: true,
});
const uuid = () => "01a1a1d6-aab6-70aa-bc15-b678935d8150";
const hoSubject = { type: "learning_mission", id: record };
const boSubject = { type: "student_mission_assignment", id: record };
const page = (events: unknown[] = [raw()], nextCursor: string | null = null) => ({ events, nextCursor });
const fail = (x: unknown, subject = hoSubject) =>
  assert.throws(() => projectMissionHistoryPage(x, subject), /lịch sử|Lịch sử|Core/);

void describe("PAP-1188 / PAP-1207 + PAP-1210 source History contract", () => {
  void it("projects only immutable redacted events into shared TDD History, no actor/notes/payload", () => {
    const data = projectMissionHistoryPage(page(), hoSubject);
    assert.equal(data.status, "authorized");
    if (data.status !== "authorized") throw Error("unexpected");
    assert.deepEqual(data.events[0], {
      id: eventId, at: "2026-11-03T14:36:13.347Z",
      actor: "Đã ẩn", action: "Cập nhật Mission", outcome: "succeeded",
      source: "Core", subject: hoSubject, redacted: true,
    });
    assert.equal(JSON.stringify(data).includes("actorId"), false);
    assert.equal(JSON.stringify(data).includes("payload"), false);
  });
  void it("denies unredacted, mismatched, extra or absent event keys instead of filtering", () => {
    for (const event of [
      { ...raw(), actorLabel: "Sensitive Staff" }, { ...raw(), actorId: uuid() },
      { ...raw(), after: { status: "INACTIVE" } }, { ...raw(), note: "private" },
      { ...raw(), redacted: false }, { ...raw(), action: "unknown.system" },
      { ...raw(), description: "private" }, { ...raw(), actorId: undefined },
    ]) fail(page([event]));
    fail({ ...page(), privatePayload: true }); fail({ events: [] });
    fail(page([raw(), raw()])); fail(page([raw("Hủy giao nhiệm vụ")]));
    fail(page([raw()], "bad-token")); fail(page([raw()], "a".repeat(2049)));
    fail(page([{ ...raw(), occurredAt: "invalid" }]));
  });
  void it("validates subject-specific actions and newest-first cursor order", () => {
    const accepted = projectMissionHistoryPage(page([raw("Giao nhiệm vụ")]), boSubject);
    assert.equal(accepted.status, "authorized");
    fail(page([raw()]), boSubject);
    const newer = { ...raw(), id: "01a1a1d6-aab6-70aa-bc15-b678935d8149", occurredAt: "2026-11-04T00:00:00Z" };
    fail(page([raw(), newer]));
  });
  void it("uses GET no-store, strict response projection and source auth failure", async () => {
    const calls: string[] = [];
    const fetcher = (async (url: string, init: RequestInit) => {
      calls.push(url);
      assert.equal(init.method, "GET"); assert.equal(init.cache, "no-store");
      return Response.json({ data: page() });
    }) as unknown as typeof fetch;
    const result = await readMissionHistory(fetcher, "/api/ho/learning/missions/" + record + "/history",
      hoSubject, null, new AbortController().signal);
    assert.equal(result.status, "authorized");
    assert.ok(calls[0]?.includes("limit=20"));
    const denied = (async () => Response.json({ error: { code: "FORBIDDEN" } }, { status: 403 })) as typeof fetch;
    await assert.rejects(readMissionHistory(denied, "/api/bo/learning/mission-assignments/" + record + "/history?centerId=" + center,
      boSubject, null, new AbortController().signal));
    const leaked = (async () => Response.json({ data: page([{ ...raw(), actorLabel: "Leak" }]) })) as typeof fetch;
    await assert.rejects(readMissionHistory(leaked, "/api/ho/learning/missions/" + record + "/history",
      hoSubject, null, new AbortController().signal));
  });
  void it("binds typed TDD History per surface and keeps authorization separate", async () => {
    assert.equal(missionDefinition.capabilities.history, "learning.mission.manage");
    assert.equal(assignmentDefinition.capabilities.history, "student.mission_assignment.view");
    assert.equal(isOperationalReadPath("learning/mission-assignments/" + record + "/history"), true);
    assert.equal(isOperationalReadPath("learning/mission-assignments/" + record + "/anything"), false);
    const f = (async (url: string) => {
      assert.ok(url.includes("/history"));
      return Response.json({ data: page([raw("Giao nhiệm vụ")]) });
    }) as typeof fetch;
    const binding = assignmentProvider.history?.bind(f, { surface: "BO", centerId: center });
    assert.equal(binding?.kind, "provider");
    if (binding?.kind !== "provider") throw Error("No BO history binding");
    const denied = await binding.load(boSubject, { surface: "BO", centerId: uuid(), authorize: () => true },
      null, new AbortController().signal);
    assert.deepEqual(denied, { status: "denied" });
    const ho = missionProvider.history?.bind(f, { surface: "HO" });
    assert.equal(ho?.kind, "provider");
  });
  void it("HO BFF rejects invalid/unknown history queries before authentication or Core", async () => {
    const base = "https://ho.staging.pinohouse.art/api/ho/learning/missions/" + record + "/history";
    const env = { APP_ENV: "staging" } as never;
    for (const query of ["?limit=0", "?limit=51", "?limit=2&limit=3", "?cursor=bad", "?centerId=" + center]) {
      const r = await handleHoMissionHistoryRead(new Request(base + query, {
        headers: { host: "ho.staging.pinohouse.art" },
      }), env, record);
      assert.equal(r.status, 400);
    }
    const wrongHost = await handleHoMissionHistoryRead(new Request(base, {
      headers: { host: "bo.staging.pinohouse.art" },
    }), env, record);
    assert.equal(wrongHost.status, 404);
  });
});


void describe("PAP-1210 BO Mission History BFF admission", () => {
  void it("forwards only exact Center and sealed cursor GET to Core; blocks spoofed/invalid queries before Core", async () => {
    const forwarded: Array<{ method: string; path: string }> = [];
    const binding = {
      executeWithStaffPassword: (request: { method: string; path: string }) => {
        forwarded.push(request);
        return Promise.resolve({ status: 200, body: { data: page([raw("Giao nhiệm vụ")]) }, requestId: "history" });
      },
    };
    const env = { PINO_BO_CORE: binding } as never;
    const path = "learning/mission-assignments/" + record + "/history";
    const make = (query: string, cookie = true) => new Request("https://bo.staging.pinohouse.art/api/bo/" + path + query, {
      headers: cookie ? { cookie: "pino_staff_password_session=local-password-session" } : {},
    });
    const params = new URLSearchParams({ centerId: center, limit: "20", cursor: "A".repeat(64) });
    const response = await handleBoOperationalReadRequest(make("?" + params), env, path);
    assert.equal(response.status, 200);
    assert.deepEqual(forwarded, [{ method: "GET", path: path + "?" + params.toString() }]);
    for (const invalid of [
      "?limit=20", "?centerId=" + center + "&limit=0", "?centerId=" + center + "&limit=51",
      "?centerId=" + center + "&cursor=bad", "?centerId=" + center + "&userId=forged",
      "?centerId=" + center + "&centerId=" + center,
    ]) {
      assert.equal((await handleBoOperationalReadRequest(make(invalid), env, path)).status, 400, invalid);
    }
    assert.equal((await handleBoOperationalReadRequest(make("?" + params, false), env, path)).status, 401);
    assert.equal((await handleBoOperationalReadRequest(make("?" + params), env, path + "/extra")).status, 404);
    assert.equal(forwarded.length, 1);
  });
});


void describe("PAP-1207 HO TDD session History transport allowlist", () => {
  void it("admits exact same-origin read-only Mission History, rejects wildcard/unsafe queries", async () => {
    const origin = "https://ho.staging.pinohouse.art";
    const calls: string[] = [];
    const session = surfaceSession("HO", origin, (async (url: string, init: RequestInit) => {
      calls.push(url); assert.equal(init.method, "GET");
      return Response.json({ data: page() });
    }) as typeof fetch);
    const path = "/api/ho/learning/missions/" + record + "/history";
    const good = await session.transport(path + "?limit=20", { method: "GET" });
    assert.equal(good.status, 200);
    assert.deepEqual(calls, [origin + path + "?limit=20"]);
    for (const bad of [
      path + "?limit=51", path + "?cursor=bad", path + "?userId=forged",
      path + "?limit=20&limit=20", path + "/extra",
      "/api/ho/learning/missions/" + record + "/delete",
      "https://bo.staging.pinohouse.art" + path,
    ]) {
      await assert.rejects(session.transport(bad, { method: "GET" }));
    }
    await assert.rejects(session.transport(path + "?limit=20", { method: "POST" }));
    assert.equal(calls.length, 1);
    session.dispose();
  });
});


void describe("PAP-1188 middleware host/verb protection", () => {
  void it("admits only same-surface staging GET for Mission History and fails closed elsewhere", () => {
    const bo = "/api/bo/learning/mission-assignments/" + record + "/history";
    const ho = "/api/ho/learning/missions/" + record + "/history";
    assert.equal(decideHostBoundary("bo.staging.pinohouse.art", bo, "GET").action, "next");
    assert.equal(decideHostBoundary("ho.staging.pinohouse.art", ho, "GET").action, "next");
    for (const [host, path, verb] of [
      ["bo.pinohouse.art", bo, "GET"], ["ho.staging.pinohouse.art", bo, "GET"],
      ["bo.staging.pinohouse.art", bo, "POST"], ["bo.staging.pinohouse.art", bo + "/extra", "GET"],
      ["bo.staging.pinohouse.art", ho, "GET"], ["ho.staging.pinohouse.art", ho, "POST"],
      ["ho.staging.pinohouse.art", ho + "/extra", "GET"], ["ho.pinohouse.art", ho, "GET"],
    ] as const) assert.equal(decideHostBoundary(host, path, verb).action, "not_found", host + " " + verb);
  });
});
