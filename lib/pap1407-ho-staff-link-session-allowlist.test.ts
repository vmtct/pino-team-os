// PAP-1407 / PAP-220 — HO TDD session admits only Founder Staff link GET.
import test from "node:test";
import assert from "node:assert/strict";
import { surfaceSession } from "./workspace-adapters/session";
import { BoApiError } from "./bo-api-error";

const center = "01a0b29a-3acd-7a18-a0f2-cf6016548ab5";
const root = "/api/ho/staff-center-links/" + center;
const origin = "https://ho.staging.pinohouse.art";

function setup() {
  const requests: Array<{ url: string; method: string }> = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: String(input), method: init?.method ?? "GET" });
    return Response.json({ data: null }, { status: 200 });
  }) as typeof fetch;
  const session = surfaceSession("HO", origin, fetcher);
  return { session, requests };
}

test("PAP-1407: Founder HO TDD may issue exact canonical Center link GET", async () => {
  const { session, requests } = setup();
  try {
    const result = await session.transport(root, { method: "GET" });
    assert.equal(result.status, 200);
    assert.deepEqual(requests, [{ url: origin + root, method: "GET" }]);
  } finally { session.dispose(); }
});

test("PAP-1407: reject HO Staff link writes, wrong Center, siblings, query and other hosts before transport", async () => {
  const { session, requests } = setup();
  try {
    for (const [path, method] of [
      [root, "POST"], [root + "/status", "POST"], [root + "/status", "GET"],
      [root + "/approve", "GET"], [root + "/", "GET"],
      [root + "?centerId=forged", "GET"], [root + "?limit=1", "GET"],
      ["/api/ho/staff-center-links/invalid", "GET"],
      ["/api/ho/staff-center-links/01a0b29a-3acd-4a18-a0f2-cf6016548ab5", "GET"],
      ["https://bo.staging.pinohouse.art" + root, "GET"],
      ["https://ho.staging.pinohouse.art.evil.example" + root, "GET"],
    ]) {
      await assert.rejects(session.transport(path, { method }), (e: unknown) => e instanceof BoApiError && e.status === 404);
    }
    assert.equal(requests.length, 0);
  } finally { session.dispose(); }
});
