import assert from "node:assert/strict";
import { test } from "node:test";
import { decidePresentationCommand } from "./presentation-command-contract";

const state = { currentPresentationId: "active", revision: 7, queuedPresentationIds: ["next"] };

test("return to ambient releases only active presentation without consuming queue", () => {
  assert.deepEqual(decidePresentationCommand(state, { op: "RETURN_TO_AMBIENT", presentationId: "active", expectedRevision: 7 }), {
    kind: "APPLY", next: { currentPresentationId: null, revision: 8, queuedPresentationIds: ["next"], completedPresentationIds: ["active"] },
  });
  assert.deepEqual(state, { currentPresentationId: "active", revision: 7, queuedPresentationIds: ["next"] });
});

test("replay snapshots never mutate queue or current singleton", () => {
  assert.deepEqual(decidePresentationCommand(state, { op: "REPLAY_SNAPSHOT", presentationId: "active", expectedRevision: 7 }), {
    kind: "APPLY", next: state, replayPresentationId: "active",
  });
  assert.deepEqual(decidePresentationCommand(state, { op: "REPLAY_SNAPSHOT", presentationId: "next", expectedRevision: 7 }), {
    kind: "REJECT", reason: "NOT_ACTIVE",
  });
  assert.deepEqual(decidePresentationCommand(state, { op: "REPLAY_SNAPSHOT", presentationId: "missing", expectedRevision: 7 }), {
    kind: "REJECT", reason: "NOT_ACTIVE",
  });
});

test("stale commands are idempotent and cannot close another active presentation", () => {
  assert.deepEqual(decidePresentationCommand(state, { op: "CLOSE_PRESENTATION", presentationId: "missing", expectedRevision: 7 }), {
    kind: "REJECT", reason: "NOT_ACTIVE",
  });
  assert.deepEqual(decidePresentationCommand(state, { op: "RETURN_TO_AMBIENT", presentationId: "next", expectedRevision: 7 }), {
    kind: "REJECT", reason: "NOT_ACTIVE",
  });
  assert.deepEqual(decidePresentationCommand(state, { op: "CLOSE_PRESENTATION", presentationId: " ", expectedRevision: 7 }), {
    kind: "REJECT", reason: "INVALID_ID",
  });
});
test("repeated close is a no-op only after the active singleton has been released", () => {
  const released = { currentPresentationId: null, revision: 8, queuedPresentationIds: ["next"], completedPresentationIds: ["active"] };
  assert.deepEqual(decidePresentationCommand(released, { op: "CLOSE_PRESENTATION", presentationId: "active", expectedRevision: 8 }), {
    kind: "NOOP", next: released,
  });
  assert.deepEqual(decidePresentationCommand(released, { op: "REPLAY_SNAPSHOT", presentationId: "next", expectedRevision: 8 }), {
    kind: "REJECT", reason: "NOT_ACTIVE",
  });
});
test("absence alone is not completion evidence for stale or forged command", () => {
  const empty = { currentPresentationId: null, revision: 8, queuedPresentationIds: [] };
  assert.deepEqual(decidePresentationCommand(empty, { op: "CLOSE_PRESENTATION", presentationId: "invented", expectedRevision: 8 }), {
    kind: "REJECT", reason: "NOT_ACTIVE",
  });
  assert.deepEqual(decidePresentationCommand(empty, { op: "RETURN_TO_AMBIENT", presentationId: "invented", expectedRevision: 8 }), {
    kind: "REJECT", reason: "NOT_ACTIVE",
  });
  const completed = { ...empty, completedPresentationIds: ["completed"] };
  assert.deepEqual(decidePresentationCommand(completed, { op: "CLOSE_PRESENTATION", presentationId: "completed", expectedRevision: 8 }), {
    kind: "NOOP", next: completed,
  });
});
test("stale operator revisions cannot replay or clear newly changed singleton", () => {
  const changed = { currentPresentationId: "second", revision: 9, queuedPresentationIds: ["third"] };
  assert.deepEqual(decidePresentationCommand(changed, { op: "RETURN_TO_AMBIENT", presentationId: "second", expectedRevision: 8 }), {
    kind: "REJECT", reason: "STALE_REVISION",
  });
  assert.deepEqual(decidePresentationCommand(changed, { op: "REPLAY_SNAPSHOT", presentationId: "second", expectedRevision: 8 }), {
    kind: "REJECT", reason: "STALE_REVISION",
  });
  assert.deepEqual(decidePresentationCommand(changed, { op: "CLOSE_PRESENTATION", presentationId: "second", expectedRevision: Number.NaN }), {
    kind: "REJECT", reason: "STALE_REVISION",
  });
});
test("successful release proposes durable completion receipt for idempotent replay of command", () => {
  const decision = decidePresentationCommand(state, { op: "RETURN_TO_AMBIENT", presentationId: "active", expectedRevision: 7 });
  assert.equal(decision.kind, "APPLY");
  if (decision.kind !== "APPLY") return;
  assert.deepEqual(decision.next.completedPresentationIds, ["active"]);
  assert.deepEqual(decidePresentationCommand(decision.next, { op: "RETURN_TO_AMBIENT", presentationId: "active", expectedRevision: 8 }), {
    kind: "NOOP", next: decision.next,
  });
});

test("invalid and overflowing revisions cannot mutate presentation state", () => {
  const max = { ...state, revision: Number.MAX_SAFE_INTEGER };
  assert.deepEqual(decidePresentationCommand(max, { op: "CLOSE_PRESENTATION", presentationId: "active", expectedRevision: max.revision }), {
    kind: "REJECT", reason: "STALE_REVISION",
  });
  const negative = { ...state, revision: -1 };
  assert.deepEqual(decidePresentationCommand(negative, { op: "CLOSE_PRESENTATION", presentationId: "active", expectedRevision: -1 }), {
    kind: "REJECT", reason: "STALE_REVISION",
  });
});
test("fail closed on duplicate and overlapping canonical queue snapshots", () => {
  const command = { op: "RETURN_TO_AMBIENT" as const, presentationId: "active", expectedRevision: 7 };
  const malformed = [
    { ...state, queuedPresentationIds: ["next", "next"] },
    { ...state, queuedPresentationIds: ["active", "next"] },
    { ...state, completedPresentationIds: ["active"] },
    { ...state, queuedPresentationIds: ["next"], completedPresentationIds: ["next"] },
    { ...state, queuedPresentationIds: [" "] },
    { ...state, completedPresentationIds: ["x", "x"] },
  ];
  for (const snapshot of malformed) {
    assert.deepEqual(decidePresentationCommand(snapshot, command), {
      kind: "REJECT", reason: "INVALID_STATE",
    });
  }
});
test('rejects inconsistent replay snapshots before emitting a replay instruction', () => {
  const invalid = { ...state, queuedPresentationIds: ['active', 'next'] };
  assert.deepEqual(decidePresentationCommand(invalid, { op: 'REPLAY_SNAPSHOT', presentationId: 'active', expectedRevision: 7 }), { kind: 'REJECT', reason: 'INVALID_STATE' });
});
