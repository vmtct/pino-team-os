import assert from "node:assert/strict";
import { test } from "node:test";
import { isPap2242M1LocalReviewEnabled } from "./pap2242-m1-local-review";

test("PAP-2242 local review is enabled only in development with the explicit flag", () => {
  assert.equal(isPap2242M1LocalReviewEnabled({ NODE_ENV: "development", BO_M1_LOCAL_REVIEW: "1" }), true);
  assert.equal(isPap2242M1LocalReviewEnabled({ NODE_ENV: "development" }), false);
  assert.equal(isPap2242M1LocalReviewEnabled({ NODE_ENV: "development", BO_M1_LOCAL_REVIEW: "true" }), false);
  assert.equal(isPap2242M1LocalReviewEnabled({ NODE_ENV: "production", BO_M1_LOCAL_REVIEW: "1" }), false);
});
