import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const r=(p:string)=>readFileSync(p,"utf8");

test("H7 R004 evaluator promotion binds reviewed exact-head CI authority",()=>{
  const helper=r("scripts/assert-evaluator-source-authority.sh");
  const flow=r(".github/workflows/access-sync-worker-secret.yml");
  for(const token of ["commits/${sha}/pulls","merge_commit_sha==$sha","actions/workflows/ci.yml/runs",".event==\"push\"",".head_branch==\"main\"",".conclusion"])
    assert.ok(helper.includes(token), token);
  assert.match(flow,/assert-evaluator-source-authority\.sh/);
  assert.match(flow,/evaluator_authority_initial/);
  assert.match(flow,/evaluator_authority_pre_promotion/);
  assert.match(flow,/evaluator_authority_final/);
  assert.match(flow,/Evaluator merged PR:/);
  assert.match(flow,/Evaluator CI run:/);
});