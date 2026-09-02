import test from "node:test";
import assert from "node:assert/strict";
import {
  LatestRequestFence,
  RetryKeyStore,
  initialEnrollmentId,
  initialSubscriptionId,
} from "./bo-school-students-state";

test("card-scoped command intent keeps the selected Subscription and Enrollment", () => {
  assert.equal(initialSubscriptionId({ kind: "renew", subscriptionId: "sub-2" }, ["sub-1", "sub-2"]), "sub-2");
  assert.equal(initialSubscriptionId({ kind: "place", subscriptionId: "sub-2" }, ["sub-1", "sub-2"]), "sub-2");
  assert.equal(initialEnrollmentId({ kind: "transfer", enrollmentId: "enr-2" }, ["enr-1", "enr-2"]), "enr-2");
});

test("latest lifecycle request fence rejects an older response", () => {
  const fence = new LatestRequestFence();
  const studentA = fence.begin();
  const studentB = fence.begin();
  assert.equal(fence.isCurrent(studentA), false);
  assert.equal(fence.isCurrent(studentB), true);
});

test("retry key is stable across ambiguous retry and rotates only after success clear", () => {
  const store = new RetryKeyStore();
  let sequence = 0;
  const create = () => `key-${++sequence}`;
  const first = store.getOrCreate("parent-1", create);
  const retry = store.getOrCreate("parent-1", create);
  assert.equal(first, "key-1");
  assert.equal(retry, first);
  store.clear("parent-1");
  assert.equal(store.getOrCreate("parent-1", create), "key-2");
});
