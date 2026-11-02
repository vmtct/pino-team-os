import assert from "node:assert/strict";
import test from "node:test";
import { canLoadAuthorizedBoPublicView } from "./bo-public-view-server-admission";

const statuses = [200, 201, 401, 403, 404, 429, 500] as const;
for (const status of statuses) {
  test(`PAP-1033 Subscription Shared View scope preflight HTTP ${status}`, async () => {
    const requests: Array<{ url: string; init: RequestInit | undefined }> = [];
    const fixture: typeof fetch = async (input, init) => {
      requests.push({ url: String(input), init });
      return new Response(status === 200 ? '{"data":[]}' : '{"error":{}}', { status, headers: { "content-type": "application/json" } });
    };
    assert.equal(await canLoadAuthorizedBoPublicView("subscriptions", fixture), status === 200);
    assert.equal(requests.length, 1);
    assert.equal(requests[0]?.url, "/api/bo/views/subscriptions");
    assert.deepEqual(requests[0]?.init, { method: "GET", cache: "no-store", credentials: "same-origin", redirect: "error" });
  });
}

test("PAP-1033 reject successful HTTP without Core JSON collection contract", async () => {
  const wrong: typeof fetch = async () => new Response("<html>login</html>", { status: 200, headers: { "content-type": "text/html" } });
  const malformed: typeof fetch = async () => new Response('{"data":{}}', { status: 200, headers: { "content-type": "application/json" } });
  const invalidJson: typeof fetch = async () => new Response("broken", { status: 200, headers: { "content-type": "application/json" } });
  assert.equal(await canLoadAuthorizedBoPublicView("subscriptions", wrong), false);
  assert.equal(await canLoadAuthorizedBoPublicView("subscriptions", malformed), false);
  assert.equal(await canLoadAuthorizedBoPublicView("subscriptions", invalidJson), false);
});

test("PAP-1033 fail closed on network error, not a simulated GLOBAL grant", async () => {
  const fail: typeof fetch = async () => { throw new Error("Network failure"); };
  assert.equal(await canLoadAuthorizedBoPublicView("subscriptions", fail), false);
});

test("existing Shared View modules retain admission and do not issue extra network requests", async () => {
  const never: typeof fetch = async () => { throw new Error("Unexpected fetch"); };
  for (const key of ["students", "classes", "staff", "audit", "world"]) {
    assert.equal(await canLoadAuthorizedBoPublicView(key, never), true);
  }
});
