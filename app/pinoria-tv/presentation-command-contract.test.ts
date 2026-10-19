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
    kind: "APPLY", next: state, replayPresentationId: "next",
  });
  assert.deepEqual(decidePresentationCommand(state, { op: "REPLAY_SNAPSHOT", presentationId: "missing" }), {
    kind: "REJECT", reason: "NOT_QUEUED",
  });
});

test("stale commands are idempotent and cannot close another active presentation", () => {
  assert.deepEqual(decidePresentationCommand(state, { op: "CLOSE_PRESENTATION", presentationId: "missing" }), {
    kind: "NOOP", next: state,
  });
  assert.deepEqual(decidePresentationCommand(state, { op: "RETURN_TO_AMBIENT", presentationId: "next" }), {
    kind: "REJECT", reason: "NOT_ACTIVE",
  });
  assert.deepEqual(decidePresentationCommand(state, { op: "CLOSE_PRESENTATION", presentationId: " " }), {
    kind: "REJECT", reason: "INVALID_ID",
  });
});