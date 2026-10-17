import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {buildBrief,canonicalBinding,canonicalOutcome,worktreePaths} from './review-run.mjs';

test('canonical binding is immutable PRE_MAIN_INDIE',()=>{
  const b=canonicalBinding('VMTCT/PINO-TEAM-OS',629,'d6e200c62462aea06339fca015f00475f6b7905d');
  assert.deepEqual(b,{reviewKind:'PRE_MAIN_INDIE',repository:'vmtct/pino-team-os',prNumber:629,candidate:'d6e200c62462aea06339fca015f00475f6b7905d'});
});

test('worktree path is deterministic and exact-head named',()=>{
  const x=worktreePaths({jiraKey:'PAP-621',repository:'vmtct/pino-team-os',candidate:'d6e200c62462aea06339fca015f00475f6b7905d'});
  assert.equal(x.source,'/home/tri/pino-work/pino-team-os');
  assert.equal(x.target,'/home/tri/pino-work/review-pap-621-pino-team-os-d6e200c');
});

test('brief contains every canonical reviewer field',()=>{
  const binding=canonicalBinding('vmtct/pino-team-os',629,'d6e200c62462aea06339fca015f00475f6b7905d');
  const brief=buildBrief({binding,pr:{baseRefName:'main',title:'Shift Leader parity'},jiraKey:'PAP-621',ledger:{dev:{exactHeadCi:{status:'SUCCESS',runId:897},reviewCompleteness:{rootInvariant:'roles remain independent',adjacentSurfaces:['api','ui'],adjacentSweepResult:'PASS',scopeReassess:'KEEP_BOUNDED'}}},risk:{families:['ACL_SCOPE_MATRIX']},files:['a.ts','b.ts']});
  for(const key of ['CANDIDATE','BASE_OR_DIFF_SCOPE','INTENDED_CHANGE','RELEVANT_CI_TESTS','REVIEW_CONTEXT','ROOT_INVARIANT','RISK_FAMILY','ADJACENT_SURFACES','ADJACENT_SWEEP_RESULT','SCOPE_REASSESS','ADJACENT_IMPACT_SCOPE','NEGATIVE_CASES'])assert.match(brief,new RegExp('^'+key+': .+','m'));
});

test('canonical outcomes never mislabel local failure as external wait',()=>{
  assert.equal(canonicalOutcome({state:'START_CONFIRMED',obligationKey:'k'}).outcome,'RUNNING');
  assert.equal(canonicalOutcome({state:'TERMINAL',obligationKey:'k',result:{verified:{verdict:'PASS'}}}).outcome,'PASS');
  assert.equal(canonicalOutcome({state:'NO_SIDE_EFFECT',obligationKey:'k',noSideEffectEvidence:{reason:'CAPACITY_EXHAUSTED_VERIFIED'}}).outcome,'BLOCKED_EXTERNAL');
  assert.throws(()=>canonicalOutcome({state:'NO_SIDE_EFFECT',obligationKey:'k',noSideEffectEvidence:{reason:'PRELAUNCH_BRIEF_ADMISSION_FAILED'}}),/ATOMIC_REVIEW_LOCAL_FAILURE/);
});

test('legacy review entrypoint files are removed',()=>{
  const dir=fileURLToPath(new URL('.',import.meta.url));
  for(const name of ['review-claim-tool.mjs','review-codex-tool.mjs','review-chatgpt-tool.mjs'])assert.equal(fs.existsSync(dir+name),false,name);
});
