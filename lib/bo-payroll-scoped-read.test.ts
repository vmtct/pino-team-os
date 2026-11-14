import test from "node:test";
import assert from "node:assert/strict";
import { payrollPeriodsAdapter } from "./bo-payroll-read-adapter";

const A = "0199f001-0000-7000-8000-000000000001";
const B = "0199f001-0000-7000-8000-000000000002";
const C = "0199f001-0000-7000-8000-000000000003";
const centers = [A, B].map((id) => ({ id, displayName: "Synthetic Center " + id.slice(-1), status: "active" }));
const response = (data: unknown, status = 200) => new Response(JSON.stringify({ data }), { status });

const stub = (calls: string[], opts: { authorized?: string[]; returnedCenter?: string; deny?: boolean } = {}) =>
  (async (input: RequestInfo | URL) => {
    const path = String(input);
    calls.push(path);
    if (path === "/api/bo/centers")
      return response(centers.filter(c => (opts.authorized ?? [A, B]).includes(c.id)));
    const u = new URL(path, "https://bo.invalid");
    if (!u.pathname.startsWith("/api/bo/workforce/payroll/periods")) throw Error("Unexpected URL: " + path);
    if (opts.deny) return response(null, 403);
    const requested = u.searchParams.get("centerId") || "";
    if (u.pathname.endsWith("/staff-rollup")) return response({
      totalsScope: "FULL_PERIOD",
      rows: [], nextOffset: null,
      periodTotals: {
        knownMinor: 10000, draftMinor: 0, finalizedMinor: 10000,
        paidMinor: 0, pendingProvisionalMinor: 0,
        draftCount: 0, pendingCount: 0, finalizedCount: 1,
        paidCount: 0, archivedUnavailableCount: 0,
        hasPending: false, hasUnavailable: false
      }
    });
    return response({
      data: [{
        id: "0199f001-0000-7000-8000-000000009999",
        centerId: opts.returnedCenter ?? requested,
        name: "Synthetic Period", startDate: "2026-11-01", endDate: "2026-11-30",
        status: "ACTIVE", createdAt:"2026-11-01T00:00:00Z", createdBy:"Synthetic Creator",updatedAt:null,updatedBy:null
      }],
      nextOffset: null, total: 1
    });
  }) as typeof fetch;

async function withMock<T>(fetcher: typeof fetch, work: () => Promise<T>): Promise<T> {
  const previous = globalThis.fetch;
  globalThis.fetch = fetcher;
  try { return await work(); } finally { globalThis.fetch = previous; }
}

test("PAP-1329 Payroll: selected Center bounds every period and rollup Core GET", async () => {
  const calls: string[] = [];
  const fetcher = stub(calls);
  await withMock(fetcher, async () => {
    const rows = await payrollPeriodsAdapter.list(fetcher, B);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.centerId, B);
    assert.equal(rows[0]?.expected != null, true);
    assert.deepEqual([rows[0]?.createdAt,rows[0]?.createdBy,rows[0]?.updatedAt,rows[0]?.updatedBy],["01/11/2026 · 07:00","Synthetic Creator","—","—"]);
  });
  assert.equal(calls[0], "/api/bo/centers");
  assert.ok(calls.some(c => c.includes("/workforce/payroll/periods") && c.includes("centerId=" + B)));
  assert.ok(calls.some(c => c.includes("/staff-rollup") && c.includes("centerId=" + B)));
  assert.equal(calls.some(c => c.includes("centerId=" + A)), false);
  assert.equal(calls.every(c => c === "/api/bo/centers" || c.includes("centerId=" + B)), true);
});

test("PAP-1329 Payroll: forged, inactive or revoked Center denied BEFORE any period read", async () => {
  for (const center of [C, "forged", B]) {
    const calls: string[] = [];
    const fetcher = stub(calls, { authorized: [A] });
    await withMock(fetcher, async () => {
      await assert.rejects(payrollPeriodsAdapter.list(fetcher, center), /không được cấp quyền/);
    });
    assert.deepEqual(calls, ["/api/bo/centers"]);
  }
});

test("PAP-1329 Payroll: Core financial GET 403 never retries another Center", async () => {
  const calls: string[] = [];
  const fetcher = stub(calls, { deny: true });
  await withMock(fetcher, async () => {
    await assert.rejects(payrollPeriodsAdapter.list(fetcher, A), /Không thể tải kỳ lương/);
  });
  assert.equal(calls.length, 2);
  assert.ok(calls[1]?.includes("centerId=" + A));
});

test("PAP-1329 Payroll: reject period tagged with foreign Center before staff-rollup GET", async () => {
  const calls: string[] = [];
  const fetcher = stub(calls, { returnedCenter: A });
  await withMock(fetcher, async () => {
    await assert.rejects(payrollPeriodsAdapter.list(fetcher, B), /khác cơ sở/);
  });
  assert.equal(calls.length, 2);
  assert.ok(calls[1]?.includes("centerId=" + B));
});

test("PAP-1329 Payroll: existing unscoped legacy adapter behavior remains until UI admission", async () => {
  const calls: string[] = [];
  const fetcher = stub(calls);
  await withMock(fetcher, async () => {
    const rows = await payrollPeriodsAdapter.list(fetcher);
    assert.equal(rows.length, 2);
    assert.deepEqual(rows.map(r => r.centerId), [A, B]);
  });
  assert.ok(calls.some(c => c.includes("centerId=" + A)));
  assert.ok(calls.some(c => c.includes("centerId=" + B)));
});
