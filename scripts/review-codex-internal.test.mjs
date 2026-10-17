import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {claimReview,reserveReviewDispatch,markReviewStarted,markReviewTerminal,inspectReview} from './review-tool-state.mjs';
import {preflightCodexRisk,statusCodexReview} from './review-codex-internal.mjs';

function setup(pr){const root=fs.mkdtempSync(path.join(os.tmpdir(),'review-codex-'));process.env.PINO_REVIEW_TOOL_STATE_DIR=path.join(root,'state');process.env.PINO_REVIEW_CODEX_STATE_DIR=path.join(root,'codex');const binding={reviewKind:'INDIE',repository:'vmtct/pino-team-os',prNumber:pr,candidate:String(pr).padStart(40,'b').slice(-40)},claim=claimReview(binding,'CODEX'),reserved=reserveReviewDispatch(claim.obligationKey,'CODEX'),resultPath=path.join(root,'result.json'),snapshotPath=path.join(root,'snapshot.json');markReviewStarted(claim.obligationKey,'CODEX',{workerPid:999999,resultPath,snapshotPath,attemptId:reserved.attemptId,dispatchId:reserved.dispatchId},reserved.dispatchId);return {root,claim:reserved,resultPath}}
function result(claim,body){return JSON.stringify({attemptId:claim.attemptId,dispatchId:claim.dispatchId,...body})}

test('verified capacity terminal is mechanical no-side-effect and leaves provider choice to caller',()=>{const {claim,resultPath}=setup(617);fs.writeFileSync(resultPath,result(claim,{status:88,stdout:'',stderr:'PINO_TOOL_LAUNCH_JSON='+JSON.stringify({state:'TERMINAL',exit_class:'CAPACITY_EXHAUSTED'})}));const r=statusCodexReview({key:claim.obligationKey});assert.equal(r.state,'NO_SIDE_EFFECT');assert.equal(r.noSideEffectEvidence.reason,'CAPACITY_EXHAUSTED_VERIFIED')});

test('capacity marker with non-capacity outer status does not authorize reclaim',()=>{const {claim,resultPath}=setup(618);fs.writeFileSync(resultPath,result(claim,{status:90,stdout:'',stderr:'PINO_TOOL_LAUNCH_JSON='+JSON.stringify({state:'TERMINAL',exit_class:'CAPACITY_EXHAUSTED'})+'\nERROR: capacity source verification failed'}));const r=statusCodexReview({key:claim.obligationKey});assert.equal(r.state,'TERMINAL');assert.equal(r.result.errorAfterStart,true)});

test('verified Codex result closes the exact claim without selecting a next action',()=>{const {claim,resultPath}=setup(619),verified={codexDirectReviewVerified:true,repository:claim.binding.repository,pr_number:claim.binding.prNumber,review_kind:'INDIE',candidate:claim.binding.candidate,verdict:'PASS',p0:0,p1:0,blocking_findings:[],reviewAuthorityPath:'/tmp/a.json'};fs.writeFileSync(resultPath,result(claim,{status:0,stdout:JSON.stringify(verified)+'\n',stderr:'PINO_TOOL_LAUNCH_JSON='+JSON.stringify({state:'TERMINAL',exit_class:'SUCCESS'})}));const r=statusCodexReview({key:claim.obligationKey});assert.equal(r.state,'TERMINAL');assert.equal(r.result.verified.verdict,'PASS');assert.equal('nextAction' in r,false)});

test('reserved dispatch never causes a second launch and waits for exact attempt result',()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'review-codex-reserved-'));process.env.PINO_REVIEW_TOOL_STATE_DIR=path.join(root,'state');process.env.PINO_REVIEW_CODEX_STATE_DIR=path.join(root,'codex');const binding={reviewKind:'INDIE',repository:'vmtct/pino-team-os',prNumber:620,candidate:'c'.repeat(40)},claim=claimReview(binding,'CODEX'),reserved=reserveReviewDispatch(claim.obligationKey,'CODEX');const r=statusCodexReview({key:reserved.obligationKey});assert.equal(r.state,'DISPATCH_RESERVED');assert.equal(r.reconciliationRequired,true)});


test('reviewed product slice risk preflight fails before dispatch on missing evidence and binds corrected slice',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'review-risk-preflight-')),helper=path.join(root,'risk.py');
  fs.writeFileSync(helper,`import json,os,sys\ns=os.environ.get('PINO_SESSION_SLICE','')\nif s!='PAP-548':\n print('ERROR: REVIEW_RISK_CONTRACT_UNRESOLVED:ledger:FileNotFoundError',file=sys.stderr);sys.exit(42)\nprint(json.dumps({'schemaVersion':1,'kind':'PINO_REVIEW_RISK_CONTRACT','sliceId':s,'manifestPath':'/tmp/pap-548.json','manifestSha256':'${'a'.repeat(64)}','families':['ACL_SCOPE_MATRIX','SURFACE_REACHABILITY'],'bindingHash':'${'b'.repeat(64)}'}))\n`);
  const prior=process.env.PINO_REVIEW_RISK_HELPER;process.env.PINO_REVIEW_RISK_HELPER=helper;
  try{assert.throws(()=>preflightCodexRisk('PAP-533'),/RISK_PREFLIGHT_FAILED/);const r=preflightCodexRisk('PAP-548');assert.equal(r.sliceId,'PAP-548');assert.equal(r.bindingHash,'b'.repeat(64));assert.deepEqual(r.families,['ACL_SCOPE_MATRIX','SURFACE_REACHABILITY']);}
  finally{if(prior===undefined)delete process.env.PINO_REVIEW_RISK_HELPER;else process.env.PINO_REVIEW_RISK_HELPER=prior;}
});

test('known risk-ledger failure before any Codex launch becomes no-side-effect and same obligation can be reclaimed',()=>{
  const {claim,resultPath}=setup(621),stderr='ERROR: REVIEW_RISK_CONTRACT_UNRESOLVED:ledger:FileNotFoundError\\nERROR: canonical review risk contract unresolved\\n';
  fs.writeFileSync(resultPath,result(claim,{status:90,stdout:'',stderr}));
  const noEffect=statusCodexReview({key:claim.obligationKey});assert.equal(noEffect.state,'NO_SIDE_EFFECT');assert.equal(noEffect.noSideEffectEvidence.reason,'PRELAUNCH_RISK_ADMISSION_FAILED');
  const retry=claimReview(claim.binding,'CODEX',{reclaimNoSideEffect:true});assert.equal(retry.state,'CLAIMED');assert.equal(retry.attemptNo,2);assert.equal(retry.reclaimed,true);
});

test('brief admission rejection before Codex process is no-side-effect and same obligation can be reclaimed',()=>{
  const {claim,resultPath}=setup(624),stderr='BRIEF_INVALID: missing candidate,diff_scope\nERROR: Codex reviewer failed with non-capacity rc=1 on profile /home/tri/.codex-vmtct97; repair Codex path, ChatGPT fallback forbidden\n';
  fs.writeFileSync(resultPath,result(claim,{status:1,stdout:'',stderr}));
  const noEffect=statusCodexReview({key:claim.obligationKey});assert.equal(noEffect.state,'NO_SIDE_EFFECT');assert.equal(noEffect.noSideEffectEvidence.reason,'PRELAUNCH_BRIEF_ADMISSION_FAILED');
  const retry=claimReview(claim.binding,'CODEX',{reclaimNoSideEffect:true});assert.equal(retry.state,'CLAIMED');assert.equal(retry.attemptNo,2);
});

test('canonical obligation-fence rejection before Codex launch is no-side-effect and reclaimable',()=>{
  const {claim,resultPath}=setup(627),lower='2'.repeat(64),stderr=`ERROR: OBLIGATION_ALREADY_CLAIMED:${lower}\nERROR: immutable review obligation already claimed or fence unavailable\n`;
  fs.writeFileSync(resultPath,result(claim,{status:92,stdout:'',stderr}));
  const noEffect=statusCodexReview({key:claim.obligationKey});assert.equal(noEffect.state,'NO_SIDE_EFFECT');assert.equal(noEffect.noSideEffectEvidence.reason,'PRELAUNCH_OBLIGATION_FENCE_REJECTED');
  const retry=claimReview(claim.binding,'CODEX',{reclaimNoSideEffect:true});assert.equal(retry.state,'CLAIMED');assert.equal(retry.attemptNo,2);
});

test('legacy terminalized exact fence rejection can recover while arbitrary rc92 stays terminal',()=>{
  const {claim}=setup(628),lower='3'.repeat(64),stderr=`ERROR: OBLIGATION_ALREADY_CLAIMED:${lower}\nERROR: immutable review obligation already claimed or fence unavailable\n`;
  markReviewTerminal(claim.obligationKey,'CODEX',{provider:'CODEX',errorAfterStart:true,status:92,signal:null,error:null,terminalLaunch:null,stderrTail:stderr});
  const recovered=statusCodexReview({key:claim.obligationKey});assert.equal(recovered.state,'NO_SIDE_EFFECT');assert.equal(recovered.noSideEffectEvidence.reason,'PRELAUNCH_OBLIGATION_FENCE_REJECTED');assert.equal(recovered.recoveredFromTerminalResultHash.length,64);
  const other=setup(629);markReviewTerminal(other.claim.obligationKey,'CODEX',{provider:'CODEX',errorAfterStart:true,status:92,signal:null,error:null,terminalLaunch:null,stderrTail:'ERROR: unrelated rc92'});
  const blocked=statusCodexReview({key:other.claim.obligationKey});assert.equal(blocked.state,'TERMINAL');
});

test('legacy terminalized brief admission can be recovered but arbitrary rc1 remains terminal',()=>{
  const {claim}=setup(625),stderr='BRIEF_INVALID: missing candidate,diff_scope\nERROR: Codex reviewer failed with non-capacity rc=1 on profile /home/tri/.codex-vmtct97; repair Codex path, ChatGPT fallback forbidden\n';
  markReviewTerminal(claim.obligationKey,'CODEX',{provider:'CODEX',errorAfterStart:true,status:1,signal:null,error:null,terminalLaunch:null,stderrTail:stderr});
  const recovered=statusCodexReview({key:claim.obligationKey});assert.equal(recovered.state,'NO_SIDE_EFFECT');assert.equal(recovered.noSideEffectEvidence.reason,'PRELAUNCH_BRIEF_ADMISSION_FAILED');
  assert.equal(recovered.recoveredFromTerminalResultHash.length,64);

  const other=setup(626);markReviewTerminal(other.claim.obligationKey,'CODEX',{provider:'CODEX',errorAfterStart:true,status:1,signal:null,error:null,terminalLaunch:null,stderrTail:'ERROR: unrelated rc1 tool failure'});
  const blocked=statusCodexReview({key:other.claim.obligationKey});assert.equal(blocked.state,'TERMINAL');
});

test('legacy terminalized risk-ledger prelaunch failure can be narrowly recovered, but generic terminal failure cannot',()=>{
  const {claim}=setup(622),stderr='ERROR: REVIEW_RISK_CONTRACT_UNRESOLVED:ledger:FileNotFoundError\\nERROR: canonical review risk contract unresolved\\n';
  markReviewTerminal(claim.obligationKey,'CODEX',{provider:'CODEX',errorAfterStart:true,status:90,signal:null,error:null,terminalLaunch:null,stderrTail:stderr});
  const recovered=statusCodexReview({key:claim.obligationKey});assert.equal(recovered.state,'NO_SIDE_EFFECT');assert.equal(recovered.recoveredFromTerminalResultHash.length,64);
  const retry=claimReview(claim.binding,'CODEX',{reclaimNoSideEffect:true});assert.equal(retry.attemptNo,2);

  const other=setup(623);markReviewTerminal(other.claim.obligationKey,'CODEX',{provider:'CODEX',errorAfterStart:true,status:90,signal:null,error:null,terminalLaunch:null,stderrTail:'ERROR: unrelated tool failure'});
  const blocked=statusCodexReview({key:other.claim.obligationKey});assert.equal(blocked.state,'TERMINAL');assert.equal(inspectReview(other.claim.obligationKey).state,'TERMINAL');
});
