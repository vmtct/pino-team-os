import assert from "node:assert/strict";
import { test } from "node:test";
import { isCurrentOperatorQueueResponse, matchesInspectedPresentation, isConfirmedPresentationRelease } from "./operator-queue-response";

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
test("operator success requires receipt ID and completedAt plus authoritative queue release", () => {
  const receipt = { presentationId: "a", completedAt: "2026-10-19T16:11:00Z" };
  const released = { current: { id: "b" }, queued: [{ id: "c" }] };
  assert.equal(isConfirmedPresentationRelease("a", receipt, released), true);
  assert.equal(isConfirmedPresentationRelease("a", { ...receipt, presentationId: "b" }, released), false);
  assert.equal(isConfirmedPresentationRelease("a", { ...receipt, completedAt: "" }, released), false);
  assert.equal(isConfirmedPresentationRelease("a", receipt, { ...released, current: { id: "a" } }), false);
  assert.equal(isConfirmedPresentationRelease("a", receipt, { ...released, queued: [{ id: "a" }] }), false);
  assert.equal(isConfirmedPresentationRelease("a", receipt, { current: null, queued: [] }), true);
});