// PAP-1472 / Epic PAP-184 — deterministic negative CD state-machine regressions.
import test from "node:test";
import assert from "node:assert/strict";
import { classifyDeployment, waitForDeployment, rollbackIfOwned } from "./pap1472-guarded-staging-cd.mjs";

const ctx = {
  previousVersion: "old-v", previousMessage: "team-cd-guarded staging sha=old run=7",
  targetMessage: "team-cd-guarded staging sha=new run=8",
  rollbackMessage: "team-cd guarded rollback from sha=new",
};
const response = (version, message, percentage = 100) => ({
  success: true, result: { deployments: [{
    id: "deployment-" + version, versions: [{ version_id: version, percentage }],
    annotations: { "workers/message": message },
  }] },
});
const old = () => response("old-v", ctx.previousMessage);
const fresh = () => response("new-v", ctx.targetMessage);
const rolled = () => response("old-v", ctx.rollbackMessage);
const conflict = () => response("unrelated-v", "concurrent writer");
const sequence = (...values) => {
  let offset = 0;
  return async () => values[Math.min(offset++, values.length - 1)];
};

test("PAP-1472: classify only exact owned 100-percent deployments", () => {
  assert.equal(classifyDeployment(old(), ctx), "PREVIOUS");
  assert.equal(classifyDeployment(fresh(), ctx), "TARGET");
  assert.equal(classifyDeployment(rolled(), ctx), "ROLLED_BACK");
  assert.equal(classifyDeployment(conflict(), ctx), "CONFLICT");
  assert.equal(classifyDeployment(response("new-v", ctx.targetMessage, 75), ctx), "CONFLICT");
  assert.equal(classifyDeployment(response("old-v", ctx.targetMessage), ctx), "CONFLICT");
  assert.equal(classifyDeployment({ success: true, result: { deployments: [{ versions: [] }] } }, ctx), "UNKNOWN");
  assert.equal(classifyDeployment({ success: false }, ctx), "UNKNOWN");
});

test("PAP-1472: Cloudflare stale PREVIOUS after successful deploy reconciles into TARGET", async () => {
  let sleeps = 0;
  const result = await waitForDeployment({
    read: sequence(old(), old(), fresh()), context: ctx, desired: "TARGET",
    attempts: 4, delay: async () => { sleeps++; },
  });
  assert.equal(result.attempt, 3);
  assert.equal(sleeps, 2);
  assert.deepEqual(result.raw, fresh());
});

test("PAP-1472: old deployment never counts as acceptance", async () => {
  await assert.rejects(
    waitForDeployment({ read: sequence(old()), context: ctx, desired: "TARGET", attempts: 3 }),
    /STAGING_CD_TARGET_READBACK_HOLD/,
  );
});

test("PAP-1472: anonymous GET failure is uncertain, then recovered by exact receipt", async () => {
  let index = 0;
  const result = await waitForDeployment({
    read: async () => { if (!index++) throw Error("network"); return fresh(); },
    context: ctx, desired: "TARGET", attempts: 3,
  });
  assert.equal(result.attempt, 2);
});

test("PAP-1472: conflicting writer fails closed without retrying to eventual success", async () => {
  await assert.rejects(waitForDeployment({
    read: sequence(old(), conflict(), fresh()), context: ctx, desired: "TARGET", attempts: 5,
  }), /STAGING_CD_CONFLICTING_WRITER/);
});

test("PAP-1472: rollback may not claim success from stale PREVIOUS", async () => {
  let writes = 0;
  await assert.rejects(rollbackIfOwned({
    read: sequence(old(), old(), old()), write: async () => { writes++; },
    context: ctx, attempts: 3,
  }), /STAGING_CD_ROLLBACK_OWNERSHIP_HOLD/);
  assert.equal(writes, 0);
});

test("PAP-1472: delayed TARGET confirmation then rollback requires tagged 100%-serving receipt", async () => {
  let count = 0;
  let wrote = false;
  const read = async () => {
    count++;
    if (count <= 2) return old();
    if (!wrote) return fresh();
    return count <= 6 ? fresh() : rolled();
  };
  const result = await rollbackIfOwned({
    read, write: async (version, message) => {
      assert.equal(version, ctx.previousVersion);
      assert.equal(message, ctx.rollbackMessage);
      wrote = true;
    }, context: ctx, attempts: 8,
  });
  assert.equal(result.alreadyRolledBack, false);
  assert.equal(classifyDeployment(result.raw, ctx), "ROLLED_BACK");
});

test("PAP-1472: rollback refuses concurrent writer and never issues POST", async () => {
  let writes = 0;
  await assert.rejects(rollbackIfOwned({
    read: sequence(conflict()), write: async () => { writes++; }, context: ctx,
  }), /STAGING_CD_CONFLICTING_WRITER/);
  assert.equal(writes, 0);
});

test("PAP-1472: pre-rollback fresh read is an ownership fence", async () => {
  let writes = 0;
  await assert.rejects(rollbackIfOwned({
    read: sequence(fresh(), conflict()),
    write: async () => { writes++; }, context: ctx,
  }), /STAGING_CD_PRE_ROLLBACK_CAS_HOLD/);
  assert.equal(writes, 0);
});

test("PAP-1472: already rollback-tagged returns without repeated POST", async () => {
  let writes = 0;
  const result = await rollbackIfOwned({
    read: sequence(rolled()), write: async () => { writes++; }, context: ctx,
  });
  assert.equal(writes, 0);
  assert.equal(result.alreadyRolledBack, true);
});

test("PAP-1472: POST transport failure never becomes a false rollback PASS", async () => {
  await assert.rejects(rollbackIfOwned({
    read: sequence(fresh()), write: async () => { throw Error("POST network loss"); },
    context: ctx, attempts: 3,
  }), /STAGING_CD_ROLLBACK_READBACK_HOLD/);
});
