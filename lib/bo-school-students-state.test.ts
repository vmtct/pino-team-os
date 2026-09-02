import test from "node:test";
import assert from "node:assert/strict";
import {
  LatestRequestFence,
  RetryKeyStore,
  clearReplayContext,
  collectPagedDirectory,
  initialEnrollmentId,
  initialSubscriptionId,
  replayContext,
} from "./bo-school-students-state";

test("card-scoped command intent keeps the selected Subscription and Enrollment", () => {
  assert.equal(initialSubscriptionId({ kind: "renew", subscriptionId: "sub-2" }, ["sub-1", "sub-2"]), "sub-2");
  assert.equal(initialSubscriptionId({ kind: "place", subscriptionId: "sub-2" }, ["sub-1", "sub-2"]), "sub-2");
  assert.equal(initialEnrollmentId({ kind: "transfer", enrollmentId: "enr-2" }, ["enr-1", "enr-2"]), "enr-2");
});

test("lifecycle fence requires both latest sequence and current Student target", () => {
  const fence = new LatestRequestFence();
  const studentA = fence.begin("student-a");
  const studentB = fence.begin("student-b");
  assert.equal(fence.isCurrent(studentA, "student-b"), false);
  assert.equal(fence.isCurrent(studentB, "student-b"), true);
  const staleA = fence.begin("student-a");
  assert.equal(fence.isCurrent(staleA, "student-b"), false);
});

test("directory pagination collects the 201st Student without truncation", async () => {
  const source = Array.from({ length: 201 }, (_, index) => ({ id: `student-${index}` }));
  const offsets: number[] = [];
  const rows = await collectPagedDirectory(async (offset, limit) => {
    offsets.push(offset);
    return source.slice(offset, offset + limit);
  });
  assert.equal(rows.length, 201);
  assert.equal(rows.at(-1)?.id, "student-200");
  assert.deepEqual(offsets, [0, 200]);
});

test("directory pagination fails visibly when a backend page does not advance", async () => {
  const page = Array.from({ length: 200 }, (_, index) => ({ id: `student-${index}` }));
  await assert.rejects(() => collectPagedDirectory(async () => page), /did not advance/);
});
test("replay context survives sheet/component remount and clears only after success", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  const firstStore = new RetryKeyStore(storage);
  const first = replayContext(firstStore, "renew:sub-2", () => "key-1", () => "2026-09-02", () => "2026-09-02T12:00:00.000Z");
  const remountedStore = new RetryKeyStore(storage);
  const retry = replayContext(remountedStore, "renew:sub-2", () => "key-2", () => "2026-09-03", () => "2026-09-03T12:00:00.000Z");
  assert.deepEqual(retry, first);
  clearReplayContext(remountedStore, "renew:sub-2");
  const afterSuccess = replayContext(new RetryKeyStore(storage), "renew:sub-2", () => "key-3", () => "2026-09-03", () => "2026-09-03T12:00:00.000Z");
  assert.equal(afterSuccess.idempotencyKey, "key-3");
});
