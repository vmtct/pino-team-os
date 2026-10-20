import assert from "node:assert/strict";
import { test } from "node:test";
import { handleTvRuntimePresentationStatus } from "./status-handler";

const display = "33333333-3333-4333-8333-333333333333";
const active = "22222222-2222-4222-8222-222222222222";
const coreResponse = (status: number, body: unknown) => ({ status, body, requestId: "local-test-id" });

test("status refuses missing session without invoking Core RPC", async () => {
  let invoked = 0;
  const response = await handleTvRuntimePresentationStatus("", display, {
    presentationStatus: async () => { invoked++; return coreResponse(200, {}); },
  });
  assert.equal(response.status, 401);
  assert.equal(invoked, 0);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("status uses opaque session and display ID, returns only active id", async () => {
  const calls: unknown[][] = [];
  const response = await handleTvRuntimePresentationStatus("opaque-token", display, {
    presentationStatus: async (...args) => {
      calls.push(args);
      return coreResponse(200, { data: { activePresentationId: active, projection: { private: true }, queued: [{ id: "hidden" }] } });
    },
  });
  assert.deepEqual(calls, [["opaque-token", display]]);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, activePresentationId: active });
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-request-id"), "local-test-id");
});

test("status propagates Core permission denial rather than falling back", async () => {
  const response = await handleTvRuntimePresentationStatus("expired-session", display, {
    presentationStatus: async () => coreResponse(403, { error: { code: "PERMISSION_DENIED" } }),
  });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: { code: "PERMISSION_DENIED" } });
});

test("status fails closed on malformed Core data and RPC failure", async () => {
  for (const body of [{}, { data: {} }, { data: { activePresentationId: "bad" } }]) {
    const result = await handleTvRuntimePresentationStatus("token", display, {
      presentationStatus: async () => coreResponse(200, body),
    });
    assert.equal(result.status, 503);
    assert.equal((await result.json() as { error: { code: string } }).error.code, "TV_PRESENTATION_STATUS_UNAVAILABLE");
  }
  const failure = await handleTvRuntimePresentationStatus("token", display, {
    presentationStatus: async () => { throw new Error("down"); },
  });
  assert.equal(failure.status, 503);
});
