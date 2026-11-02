import assert from "node:assert/strict";
import test from "node:test";
import { authorizedWorkforceSnapshots } from "../app/bo/architecture/workforce-read-adapters";

function stubbedFetcher(options: { centers: number; weeks: number; deny?: string }) {
  let active = 0;
  let maxActive = 0;
  const readCalls: string[] = [];
  const centers = Array.from({ length: options.centers }, (_, i) => ({ id: `center-${i}`, displayName: `Center ${i}` }));
  const weekList = Array.from({ length: options.weeks }, (_, i) => ({
    id: `week-${i}`, code: `W${i}`, termId: "term-1",
    startDate: "2026-12-01", endDate: "2026-12-07", ordinal: i + 1,
  }));
  const fetcher: typeof fetch = async (input) => {
    const url = new URL(String(input), "https://staging.invalid");
    if (url.pathname.endsWith("/bootstrap")) return Response.json({ data: { centers, termWeeks: weekList, terms: [] } });
    if (url.pathname.endsWith("/global-weeks")) {
      return Response.json({ data: { termWeeks: weekList, terms: [] } });
    }
    if (!url.pathname.endsWith("/weekly")) throw new Error("Unexpected URL: " + url.pathname);
    const centerId = url.searchParams.get("centerId");
    const termWeekId = url.searchParams.get("termWeekId");
    const key = centerId + ":" + termWeekId;
    readCalls.push(key);
    active++;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, (termWeekId === "week-0" ? 12 : 3)));
    active--;
    if (key === options.deny) return Response.json({ error: { code: "ACCESS_SURFACE_DENIED" } }, { status: 403 });
    return Response.json({ data: { centerId, termWeekId, staff: [], templates: [], availability: [], assignments: [], windows: {} } });
  };
  return { fetcher, centers, weekList, readCalls, getMaxActive: () => maxActive };
}

test("Founder multi-Center read uses at most four concurrent week calls and preserves stable order", async () => {
  const stub = stubbedFetcher({ centers: 7, weeks: 4 });
  const { weeks, snapshots } = await authorizedWorkforceSnapshots(stub.fetcher);
  assert.equal(weeks.bootstrap.centers.length, 7);
  assert.equal(snapshots.length, 28);
  assert.equal(stub.readCalls.length, 28);
  assert.ok(stub.getMaxActive() > 1 && stub.getMaxActive() <= 4);
  const expected = stub.centers.flatMap((center) => stub.weekList.map((week) => center.id + ":" + week.id));
  assert.deepEqual(snapshots.map((snapshot) => snapshot.centerId + ":" + snapshot.termWeekId), expected);
});

test("single Center and empty Center scopes do not expand or invent results", async () => {
  const single = stubbedFetcher({ centers: 1, weeks: 4 });
  assert.equal((await authorizedWorkforceSnapshots(single.fetcher)).snapshots.length, 4);
  const empty = stubbedFetcher({ centers: 0, weeks: 4 });
  assert.deepEqual((await authorizedWorkforceSnapshots(empty.fetcher)).snapshots, []);
  assert.equal(empty.readCalls.length, 0);
});

test("any denied Center/week fails closed instead of returning partial scheduling rows", async () => {
  const stub = stubbedFetcher({ centers: 3, weeks: 4, deny: "center-1:week-1" });
  await assert.rejects(authorizedWorkforceSnapshots(stub.fetcher), /Workforce API read failed: HTTP 403/);
});
