import assert from "node:assert/strict";
import { test } from "node:test";
import { isCurrentOperatorQueueResponse, matchesInspectedPresentation } from "./operator-queue-response";

test("accepts only the latest request for the visible Center", () => {
  assert.equal(isCurrentOperatorQueueResponse("center-a", 3, "center-a", 3), true);
  assert.equal(isCurrentOperatorQueueResponse("center-a", 3, "center-b", 4), false);
  assert.equal(isCurrentOperatorQueueResponse("center-a", 3, "center-a", 4), false);
  assert.equal(isCurrentOperatorQueueResponse("center-a", 3, "center-b", 3), false);
});

test("snapshot inspection never accepts a changed claim token or ID", () => {
  const current = { id: "presentation-1", claimedAt: "2026-10-19T15:40:00Z" };
  assert.equal(matchesInspectedPresentation(current, { ...current }), true);
  assert.equal(matchesInspectedPresentation(current, { ...current, claimedAt: "2026-10-19T15:41:00Z" }), false);
  assert.equal(matchesInspectedPresentation(current, { ...current, id: "presentation-2" }), false);
});