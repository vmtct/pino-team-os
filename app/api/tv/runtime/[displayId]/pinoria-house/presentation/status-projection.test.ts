import assert from "node:assert/strict";
import { test } from "node:test";
import { projectTvRuntimeStatus } from "./status-projection";

test("runtime status projects only current ID and no private Core data", () => {
  const id = "22222222-2222-4222-8222-222222222222";
  const input = { data: { activePresentationId: id, current: { projection: { secret: true } }, queued: ["private"] } };
  assert.deepEqual(projectTvRuntimeStatus(input), { ok: true, activePresentationId: id });
  assert.equal(JSON.stringify(projectTvRuntimeStatus(input)).includes("secret"), false);
  assert.deepEqual(projectTvRuntimeStatus({ data: { activePresentationId: null } }), { ok: true, activePresentationId: null });
});

test("runtime status rejects malformed/absent envelopes, not a false ambient release", () => {
  for (const invalid of [undefined, null, {}, { data: null }, { data: {} },
    { data: { activePresentationId: undefined } }, { data: { activePresentationId: "wrong-id" } },
    { data: { activePresentationId: 4 } }, { data: [] }]) {
    assert.throws(() => projectTvRuntimeStatus(invalid), /unavailable/);
  }
});
