import test from "node:test";
import assert from "node:assert/strict";
import { resolveActionBoundIntentId, shouldRestoreActionBoundIntent } from "./bo-lead-action-binding";

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
