import assert from "node:assert/strict";
import test from "node:test";
import { instanceBelongsToSelectedLearner, shouldApplyInstanceLoad } from "./pinoria-world-instance-load";

test("stale or out-of-order learner loads cannot replace the current learner context",()=>{
  assert.equal(shouldApplyInstanceLoad(4,5,"learner-b","learner-a"),false);
  assert.equal(shouldApplyInstanceLoad(4,5,"learner-b","learner-b"),false);
  assert.equal(shouldApplyInstanceLoad(5,5,"learner-b","learner-a"),false);
  assert.equal(shouldApplyInstanceLoad(5,5,"learner-b","learner-b"),true);
});

test("WorldInstance actions are exposed only for the selected learner",()=>{
  assert.equal(instanceBelongsToSelectedLearner("learner-a","learner-b"),false);
  assert.equal(instanceBelongsToSelectedLearner("learner-a","learner-a"),true);
  assert.equal(instanceBelongsToSelectedLearner(null,"learner-a"),false);
});
