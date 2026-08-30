import test from "node:test";
import assert from "node:assert/strict";
import { correctWorkforceAssignment } from "./workforce-planning-correction";

test("correction never creates a replacement if cancellation fails", async () => {
  const calls: string[] = [];
  await assert.rejects(
    correctWorkforceAssignment(
      async () => { calls.push("cancel"); throw new Error("cancel failed"); },
      async () => { calls.push("create"); return "replacement"; },
    ),
    /cancel failed/,
  );
  assert.deepEqual(calls, ["cancel"]);
});

test("correction creates replacement only after canonical cancellation", async () => {
  const calls: string[] = [];
  const result = await correctWorkforceAssignment(
    async () => { calls.push("cancel"); },
    async () => { calls.push("create"); return { id: "new" }; },
  );
  assert.deepEqual(calls, ["cancel", "create"]);
  assert.deepEqual(result, { state: "REPLACED", replacement: { id: "new" } });
});

test("replacement failure preserves explicit cancelled-only partial state", async () => {
  const result = await correctWorkforceAssignment(
    async () => undefined,
    async () => { throw new Error("replacement failed"); },
  );
  assert.equal(result.state, "CANCELLED_ONLY");
  if (result.state === "CANCELLED_ONLY") assert.match(String(result.error), /replacement failed/);
});
