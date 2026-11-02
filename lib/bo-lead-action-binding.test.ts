import test from "node:test";
import assert from "node:assert/strict";
import { isIntentDetailCurrent, resolveActionBoundIntentId, shouldRestoreActionBoundIntent } from "./bo-lead-action-binding";

test("PAP-390 keeps lifecycle action target authoritative across browser-history selection drift", () => {
  assert.equal(resolveActionBoundIntentId("intent-b", "intent-a"), "intent-a");
  assert.equal(shouldRestoreActionBoundIntent("intent-b", "intent-a"), true);
  assert.equal(resolveActionBoundIntentId("intent-a", "intent-a"), "intent-a");
  assert.equal(shouldRestoreActionBoundIntent("intent-a", "intent-a"), false);
});

test("PAP-390 follows URL selection when no lifecycle attempt is bound", () => {
  assert.equal(resolveActionBoundIntentId("intent-b", null), "intent-b");
  assert.equal(resolveActionBoundIntentId(null, null), null);
  assert.equal(shouldRestoreActionBoundIntent("intent-b", null), false);
});

test("PAP-390 never treats stale detail as current after selection changes", () => {
  assert.equal(isIntentDetailCurrent("intent-b", "intent-a"), false);
  assert.equal(isIntentDetailCurrent("intent-b", "intent-b"), true);
  assert.equal(isIntentDetailCurrent(null, "intent-a"), false);
  assert.equal(isIntentDetailCurrent("intent-b", null), false);
});
