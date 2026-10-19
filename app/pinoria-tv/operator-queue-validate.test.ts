import assert from "node:assert/strict";
import { test } from "node:test";
import { parseOperatorQueue } from "./operator-queue-validate";

const valid = {
  current: { id: "active", kind: "WISH_REVEAL", claimedAt: "2026-10-19T15:45:00Z", projection: {} },
  queued: [{ id: "queued", kind: "EGG_HATCH" }],
  revision: 42,
  hasMore: false,
};

test("accepts canonical queue without changing projection", () => {
  assert.equal(parseOperatorQueue(valid), valid);
  assert.equal(parseOperatorQueue({ ...valid, current: null }).revision, 42);
});

test("rejects malformed queue/active snapshots and duplicate or overlapping IDs", () => {
  const malformed = [
    null, {}, { ...valid, revision: -1 }, { ...valid, revision: NaN },
    { ...valid, revision: Number.MAX_SAFE_INTEGER + 1 }, { ...valid, hasMore: "false" },
    { ...valid, current: undefined }, { ...valid, current: { id: "active" } },
    { ...valid, current: { ...valid.current, projection: "private" } },
    { ...valid, queued: [{}] }, { ...valid, queued: [valid.queued[0], valid.queued[0]] },
    { ...valid, queued: [{ id: "active", kind: "EGG_HATCH" }] },
    { ...valid, queued: Array.from({ length: 51 }, (_, index) => ({ id: "p" + index, kind: "EGG_HATCH" })) },
  ];
  for (const snapshot of malformed) {
    assert.throws(() => parseOperatorQueue(snapshot), /operator.*snapshot|active presentation/i);
  }
});
