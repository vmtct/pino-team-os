import assert from "node:assert/strict";
import { test } from "node:test";
import { decidePresentationCommand } from "./presentation-command-contract";

const state = { currentPresentationId: "active", revision: 7, queuedPresentationIds: ["next"] };

test("return to ambient releases only active presentation without consuming queue", () => {
  assert.deepEqual(decidePresentationCommand(state, { op: "RETURN_TO_AMBIENT", presentationId: "active", expectedRevision: 7 }), {
    kind: "APPLY", next: { currentPresentationId: null, revision: 8, queuedPresentationIds: ["next"] },
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