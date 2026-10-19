import assert from "node:assert/strict";
import { test } from "node:test";
import { presentationStatus } from "./presentation-client";

test("TV status reads only current ID without claiming or completing", async () => {
  const previous = globalThis.fetch;
  let request: RequestInit | undefined;
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    request = init;
    return Response.json({ ok: true, activePresentationId: "active-id" });
  }) as typeof fetch;
  try {
    assert.equal(await presentationStatus("center"), "active-id");
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
