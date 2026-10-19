import assert from "node:assert/strict";
import { test } from "node:test";
import { decidePresentationCommand } from "./presentation-command-contract";

const state = { currentPresentationId: "active", queuedPresentationIds: ["next"] };

test("return to ambient releases only active presentation without consuming queue", () => {
  assert.deepEqual(decidePresentationCommand(state, { op: "RETURN_TO_AMBIENT", presentationId: "active" }), {
    kind: "APPLY", next: { currentPresentationId: null, queuedPresentationIds: ["next"] },
  });
  assert.deepEqual(state, { currentPresentationId: "active", queuedPresentationIds: ["next"] });
});

test("replay snapshots never mutate queue or current singleton", () => {
  assert.deepEqual(decidePresentationCommand(state, { op: "REPLAY_SNAPSHOT", presentationId: "active" }), {
    kind: "APPLY", next: state, replayPresentationId: "active",
  });
  assert.deepEqual(decidePresentationCommand(state, { op: "REPLAY_SNAPSHOT", presentationId: "next" }), {
    kind: "REJECT", reason: "NOT_ACTIVE",
  });
  assert.deepEqual(decidePresentationCommand(state, { op: "REPLAY_SNAPSHOT", presentationId: "missing" }), {
    kind: "REJECT", reason: "NOT_ACTIVE",
  });
});

test("stale commands are idempotent and cannot close another active presentation", () => {
  assert.deepEqual(decidePresentationCommand(state, { op: "CLOSE_PRESENTATION", presentationId: "missing" }), {
    kind: "REJECT", reason: "NOT_ACTIVE",
  });
  assert.deepEqual(decidePresentationCommand(state, { op: "RETURN_TO_AMBIENT", presentationId: "next" }), {
    kind: "REJECT", reason: "NOT_ACTIVE",
  });
  assert.deepEqual(decidePresentationCommand(state, { op: "CLOSE_PRESENTATION", presentationId: " " }), {
    kind: "REJECT", reason: "INVALID_ID",
  });
});
test("repeated close is a no-op only after the active singleton has been released", () => {
  const released = { currentPresentationId: null, queuedPresentationIds: ["next"], completedPresentationIds: ["active"] };
  assert.deepEqual(decidePresentationCommand(released, { op: "CLOSE_PRESENTATION", presentationId: "active" }), {
    kind: "NOOP", next: released,
  });
  assert.deepEqual(decidePresentationCommand(released, { op: "REPLAY_SNAPSHOT", presentationId: "next" }), {
    kind: "REJECT", reason: "NOT_ACTIVE",
  });
});
test("absence alone is not completion evidence for stale or forged command", () => {
  const empty = { currentPresentationId: null, queuedPresentationIds: [] };
  assert.deepEqual(decidePresentationCommand(empty, { op: "CLOSE_PRESENTATION", presentationId: "invented" }), {
    kind: "REJECT", reason: "NOT_ACTIVE",
  });
  assert.deepEqual(decidePresentationCommand(empty, { op: "RETURN_TO_AMBIENT", presentationId: "invented" }), {
    kind: "REJECT", reason: "NOT_ACTIVE",
  });
  const completed = { ...empty, completedPresentationIds: ["completed"] };
  assert.deepEqual(decidePresentationCommand(completed, { op: "CLOSE_PRESENTATION", presentationId: "completed" }), {
    kind: "NOOP", next: completed,
  });
});