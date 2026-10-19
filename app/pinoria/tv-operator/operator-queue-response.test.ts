import assert from "node:assert/strict";
import { test } from "node:test";
import { isCurrentOperatorQueueResponse } from "./operator-queue-response";

test("accepts only the latest request for the visible Center", () => {
  assert.equal(isCurrentOperatorQueueResponse("center-a", 3, "center-a", 3), true);
  assert.equal(isCurrentOperatorQueueResponse("center-a", 3, "center-b", 4), false);
  assert.equal(isCurrentOperatorQueueResponse("center-a", 3, "center-a", 4), false);
  assert.equal(isCurrentOperatorQueueResponse("center-a", 3, "center-b", 3), false);
});
