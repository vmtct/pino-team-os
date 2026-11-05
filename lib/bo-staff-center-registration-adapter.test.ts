// PAP-1407 / PAP-220 — BO Staff registration tab reads only current Center.
import test from "node:test";
import assert from "node:assert/strict";
import { readStaffCenterApplications } from "./bo-staff-center-registration-adapter";

const centerA = "01912345-6789-7abc-8def-0123456789ab";
const centerB = "01912345-6789-7abc-8def-0123456789ac";
const requestId = "01922345-6789-7abc-8def-0123456789ab";
const pending = {
  id: requestId, centerId: centerA,
  displayLabel: "Synthetic Staff", submittedAt: "2026-11-05T00:00:00.000Z", version: 2,
};
function stub(response: unknown, status = 200) {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const fetcher = (async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(response), { status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { fetcher, calls };
}
test("PAP-1407: Center-bound list projects minimal Table/Drawer record", async () => {
  const { fetcher, calls } = stub({ data: [pending] });
  assert.deepEqual(await readStaffCenterApplications(fetcher, centerA), [{
    id: requestId, name: "Synthetic Staff", status: "Chờ duyệt",
    submittedAt: pending.submittedAt, version: 2, centerId: centerA,
  }]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, "/api/bo/workforce/staff-center-registration-requests?centerId=" + centerA);
  assert.equal(calls[0]?.init?.credentials, "same-origin");
  assert.equal(calls[0]?.init?.cache, "no-store");
  assert.equal(calls[0]?.init?.method, "GET");
});
test("PAP-1407: empty authorized Center result is empty; 401/403/error never fall back to Global", async () => {
  assert.deepEqual(await readStaffCenterApplications(stub({ data: [] }).fetcher, centerA), []);
  for (const status of [401, 403, 404, 500]) {
    const { fetcher, calls } = stub({ error: { code: "DENIED" } }, status);
    await assert.rejects(readStaffCenterApplications(fetcher, centerA));
    assert.equal(calls.length, 1);
    assert.ok(calls[0]!.url.includes("centerId=" + centerA));
  }
});
test("PAP-1407: forged/missing Center fails before fetch", async () => {
  const { fetcher, calls } = stub({ data: [] });
  for (const center of ["", "center-all", centerA + "&userId=forged"]) {
    await assert.rejects(readStaffCenterApplications(fetcher, center));
  }
  assert.equal(calls.length, 0);
});
test("PAP-1407: no cross-Center row, duplicate, malformed data or excessive page enters TDD", async () => {
  for (const data of [
    [{ ...pending, centerId: centerB }],
    [{ ...pending, id: "invalid" }],
    [{ ...pending, version: -1 }],
    [{ ...pending, displayLabel: "" }],
    [{ ...pending, submittedAt: "invalid" }],
    [pending, pending],
    Array.from({ length: 51 }, (_, i) => ({ ...pending, id: requestId.slice(0,-2) + String(i).padStart(2, "0") })),
  ]) {
    await assert.rejects(readStaffCenterApplications(stub({ data }).fetcher, centerA));
  }
  await assert.rejects(readStaffCenterApplications(stub({ wrong: [] }).fetcher, centerA));
  await assert.rejects(readStaffCenterApplications(stub({ data: {} }).fetcher, centerA));
});
