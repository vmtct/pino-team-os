import assert from "node:assert/strict";
import { test } from "node:test";
import { tvActiveStatusProjection } from "./status-projection";

test("TV status reduces Core inspection to active ID only, not queue or projection", () => {
  const activeId = "11111111-1111-4111-8111-111111111111";
  const inspection = {
    current: { id: activeId, kind: "WISH_REVEAL", claimedAt: "claim", projection: { private: "secret" } },
    queued: [{ id: "queued-private", kind: "EGG_HATCH" }],
    hasMore: true,
    revision: 10,
  };
  assert.deepEqual(tvActiveStatusProjection(inspection), { ok: true, activePresentationId: activeId });
  assert.equal(JSON.stringify(tvActiveStatusProjection(inspection)).includes("secret"), false);
  assert.deepEqual(tvActiveStatusProjection({ current: null, queued: [], hasMore: false }), {
    ok: true, activePresentationId: null,
  });
});

test("TV status rejects absent, malformed, or ambiguous Core snapshots", () => {
  for (const invalid of [undefined, null, {}, { current: undefined }, { current: {} },
    { current: { id: "invalid" } }, { current: [] }, [], "missing"]) {
    assert.throws(() => tvActiveStatusProjection(invalid), /Pinoria TV/);
  }
});
