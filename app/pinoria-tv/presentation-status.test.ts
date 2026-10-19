import assert from "node:assert/strict";
import { test } from "node:test";
import { presentationStatus, shouldReleaseTvScene, isCurrentTvPresentationClaim } from "./presentation-client";

test("TV status reads only current ID without claiming or completing", async () => {
  const previous = globalThis.fetch;
  let request: RequestInit | undefined;
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    request = init;
    return Response.json({ ok: true, activePresentationId: "11111111-1111-4111-8111-111111111111" });
  }) as typeof fetch;
  try {
    assert.equal(await presentationStatus("center"), "11111111-1111-4111-8111-111111111111");
    assert.deepEqual(JSON.parse(request?.body as string), { op: "status", centerId: "center" });
    assert.equal(request?.method, "POST");
    assert.equal(request?.cache, "no-store");
  } finally { globalThis.fetch = previous; }
});

test("TV status distinguishes released current scene and fails closed on unavailable status", async () => {
  const previous = globalThis.fetch;
  try {
    globalThis.fetch = (async () => Response.json({ ok: true, activePresentationId: null })) as typeof fetch;
    assert.equal(await presentationStatus("center"), null);
    globalThis.fetch = (async () => Response.json({ ok: false, error: "UNAVAILABLE" }, { status: 503 })) as typeof fetch;
    await assert.rejects(presentationStatus("center"), /status unavailable/);
    globalThis.fetch = (async () => Response.json({ ok: true })) as typeof fetch;
    await assert.rejects(presentationStatus("center"), /status unavailable/);
  } finally { globalThis.fetch = previous; }
});

test("status response rejects noncanonical IDs instead of clearing a real scene", async () => {
  const previous = globalThis.fetch;
  try {
    for (const bad of ["active-id", "", "00000000-0000-0000-0000-00000000000x", 3]) {
      globalThis.fetch = (async () => Response.json({ ok: true, activePresentationId: bad })) as typeof fetch;
      await assert.rejects(presentationStatus("center"), /status unavailable/);
    }
  } finally { globalThis.fetch = previous; }
});

test("TV release decision requires canonical current ID and changed Core active state", () => {
  const current = "11111111-1111-4111-8111-111111111111";
  assert.equal(shouldReleaseTvScene(current, current), false);
  assert.equal(shouldReleaseTvScene(current, null), true);
  assert.equal(shouldReleaseTvScene(current, "22222222-2222-4222-8222-222222222222"), true);
  assert.equal(shouldReleaseTvScene("not-a-real-id", null), false);
});
test("claims arriving after Center change or request generation invalidation are discarded", () => {
  assert.equal(isCurrentTvPresentationClaim("center-a", 5, "center-a", 5), true);
  assert.equal(isCurrentTvPresentationClaim("center-a", 5, "center-b", 6), false);
  assert.equal(isCurrentTvPresentationClaim("center-a", 5, "center-a", 6), false);
  assert.equal(isCurrentTvPresentationClaim("center-a", 5, "center-b", 5), false);
});