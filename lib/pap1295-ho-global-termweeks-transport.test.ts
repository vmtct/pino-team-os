import test from "node:test";
import assert from "node:assert/strict";
import { BoApiError } from "./bo-api-error";
import { surfaceSession } from "./workspace-adapters/session";
import { createHoTddAdapter } from "./workspace-adapters";
import { TddRegistry } from "./workspace-schema";
import {
  termWeekDefinition,
  termWeekProvider,
  termWeekQuery,
  verifyGlobalWeekExtensionApproval,
} from "../app/ho/workforce/term-weeks/schema";

const origin = "https://ho.staging.pinohouse.art";
const collection = "/api/ho/workforce/global-termweeks";
const termId = "01900000-0000-7000-8000-000000000001";
const weeks = Array.from({ length: 4 }, (_, i) => ({
  id: `01900000-0000-7000-8000-${String(i + 2).padStart(12, "0")}`,
  termId,
  name: `Term · W${i + 1}`,
  code: `W${i + 1}`,
  startDate: `2026-11-${String(2 + i * 7).padStart(2, "0")}`,
  endDate: `2026-11-${String(8 + i * 7).padStart(2, "0")}`,
  rhythmKey: "BUILD",
  ordinal: i + 1,
}));

const rejected = (status: number) => (error: unknown) =>
  error instanceof BoApiError && error.status === status;

test("PAP-1295: authenticated HO TDD list + detail read four real-shaped Global TermWeeks", async () => {
  const calls: { url: URL; init: RequestInit | undefined }[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    calls.push({ url, init });
    assert.equal(url.origin, origin);
    assert.equal(init?.credentials, "same-origin");
    assert.equal(init?.cache, "no-store");
    assert.equal(init?.redirect, "error");
    assert.equal(init?.method, "GET");
    if (url.pathname === "/api/bo/context") return Response.json({
      data: {
        surface: "BO", entitled: true, userId: "pap1295-founder",
        permissionKeys: ["team.bo.access", "operating_cycle.global_week.lock", "operating_cycle.global_week.manage"],
      },
    });
    if (url.pathname === collection && !url.search) return Response.json({ data: weeks });
    throw Error(`Unexpected transport request: ${url.pathname}${url.search}`);
  };
  const controller = new AbortController();
  const adapter = await createHoTddAdapter({
    origin,
    fetcher,
    registry: new TddRegistry(verifyGlobalWeekExtensionApproval),
    definition: termWeekDefinition,
    provider: termWeekProvider,
  }, controller.signal);
  try {
    assert.equal(adapter.context.surface, "HO");
    assert.equal(adapter.context.authorize("operating_cycle.global_week.lock"), true);
    const listed = await adapter.list(termWeekQuery, controller.signal);
    assert.equal(listed.total, 4);
    assert.deepEqual(listed.rows.map(row => row.id), weeks.map(week => week.id));
    assert.deepEqual(listed.rows.map(row => row.name), weeks.map(week => week.name));
    const detailed = await adapter.detail(weeks[3]!.id, controller.signal);
    assert.equal(detailed?.row.code, "W4");
    const readCalls = calls.filter(call => call.url.pathname === collection);
    assert.equal(readCalls.length, 2, "only one collection GET per list/detail");
    assert.ok(readCalls.every(call => call.url.search === "" && call.init?.method === "GET"));
  } finally {
    adapter.dispose();
  }
});

test("PAP-1295: only an exact HO GET without query or hostile headers is admitted", async () => {
  let dispatched = 0;
  const fetcher: typeof fetch = async () => {
    dispatched++;
    return Response.json({ data: weeks });
  };
  const session = surfaceSession("HO", origin, fetcher);
  try {
    const response = await session.transport(collection, { method: "GET" });
    assert.equal(response.status, 200);
    assert.equal(dispatched, 1);
    for (const pathname of [
      collection + "?centerId=" + termId,
      collection + "?unexpected=1",
      collection + "/",
      collection + "/" + weeks[0]!.id,
      collection + "/../global-week-registration",
      "https://bo.staging.pinohouse.art" + collection,
      "https://ho.pinohouse.art" + collection,
      collection + "#fragment",
    ]) {
      await assert.rejects(session.transport(pathname, { method: "GET" }), rejected(404), pathname);
    }
    for (const method of ["POST", "PUT", "PATCH", "DELETE", "HEAD"]) {
      await assert.rejects(session.transport(collection, { method }), rejected(404), method);
    }
    for (const key of ["authorization", "cookie", "host", "x-pino-surface"]) {
      await assert.rejects(
        session.transport(collection, { method: "GET", headers: { [key]: "untrusted" } }),
        rejected(403),
        key,
      );
    }
    assert.equal(dispatched, 1, "all denied requests must fail locally before dispatch");
  } finally {
    session.dispose();
  }
});

test("PAP-1295: BO and Production origins cannot borrow HO GLOBAL read transport", async () => {
  const neverFetch: typeof fetch = async () => { throw Error("must not dispatch"); };
  assert.throws(() => surfaceSession("HO", "https://ho.pinohouse.art", neverFetch), rejected(404));
  assert.throws(() => surfaceSession("HO", "https://bo.staging.pinohouse.art", neverFetch), rejected(404));
  const bo = surfaceSession("BO", "https://bo.staging.pinohouse.art", neverFetch, {
    id: termId,
    source: "centers",
  });
  try {
    await assert.rejects(bo.transport(collection, { method: "GET" }), rejected(404));
  } finally {
    bo.dispose();
  }
});
