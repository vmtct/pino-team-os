// PAP-1407 / PAP-220 — Founder HO Staff Link Center directory wire contract.
import test from "node:test";
import assert from "node:assert/strict";
import { readHoStaffLinkCenters } from "./ho-staff-center-directory";

const idA = "01a0b29a-3acd-7a18-a0f2-cf6016548ab5";
const idB = "01a0b29a-3acd-7a18-a0f2-cf6016548ab6";
const center = { id: idA, key: "synthetic-a", displayName: "Synthetic Center", status: "ACTIVE" };
function mock(payload: unknown, status = 200) {
  const requests: { uri: string; init?: RequestInit }[] = [];
  const fetcher = (async (uri: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ uri: String(uri), init });
    return Response.json(payload, { status });
  }) as typeof fetch;
  return { fetcher, requests };
}
test("PAP-1407: real BO Center directory contract maps displayName and key, never name or centerKey", async () => {
  const { fetcher, requests } = mock({ data: [center, { ...center, id: idB, key: "synthetic-b", displayName: "Second Center" }] });
  assert.deepEqual(await readHoStaffLinkCenters(fetcher), [
    { id: idA, centerKey: "synthetic-a", name: "Synthetic Center" },
    { id: idB, centerKey: "synthetic-b", name: "Second Center" },
  ]);
  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.uri, "/api/bo/centers");
  assert.equal(requests[0]?.init?.credentials, "same-origin");
  assert.equal(requests[0]?.init?.method, "GET");
  assert.equal(requests[0]?.init?.cache, "no-store");
  assert.equal(requests[0]?.init?.redirect, "error");
});
test("PAP-1407: empty authorized Centers returns empty, unauthorized or missing backend fail closed", async () => {
  assert.deepEqual(await readHoStaffLinkCenters(mock({ data: [] }).fetcher), []);
  for (const status of [401, 403, 404, 500]) {
    const { fetcher, requests } = mock({ error: { code: "DENIED" } }, status);
    await assert.rejects(readHoStaffLinkCenters(fetcher));
    assert.equal(requests.length, 1);
  }
});
test("PAP-1407: duplicate IDs, legacy schema, fake IDs and missing names are never admitted", async () => {
  for (const data of [
    [center, center],
    [{ ...center, id: "forged" }],
    [{ ...center, id: "01a0b29a-3acd-4a18-a0f2-cf6016548ab5" }],
    [{ ...center, key: "" }],
    [{ ...center, displayName: "" }],
    [{ id: idA, centerKey: "old", name: "Legacy" }],
    Array.from({ length: 501 }, () => center),
  ]) {
    await assert.rejects(readHoStaffLinkCenters(mock({ data }).fetcher));
  }
  for (const payload of [{}, null, { data: {} }, { centers: [] }, { data: [null] }]) {
    await assert.rejects(readHoStaffLinkCenters(mock(payload).fetcher));
  }
});
