import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {claimReview,reserveReviewDispatch,markReviewStarted} from './review-tool-state.mjs';
import {statusCodexReview} from './review-codex-tool.mjs';

function setup(pr){const root=fs.mkdtempSync(path.join(os.tmpdir(),'review-codex-'));process.env.PINO_REVIEW_TOOL_STATE_DIR=path.join(root,'state');process.env.PINO_REVIEW_CODEX_STATE_DIR=path.join(root,'codex');const binding={reviewKind:'INDIE',repository:'vmtct/pino-team-os',prNumber:pr,candidate:String(pr).padStart(40,'b').slice(-40)},claim=claimReview(binding,'CODEX'),reserved=reserveReviewDispatch(claim.obligationKey,'CODEX'),resultPath=path.join(root,'result.json'),snapshotPath=path.join(root,'snapshot.json');markReviewStarted(claim.obligationKey,'CODEX',{workerPid:999999,resultPath,snapshotPath,attemptId:reserved.attemptId,dispatchId:reserved.dispatchId},reserved.dispatchId);return {root,claim:reserved,resultPath}}
function result(claim,body){return JSON.stringify({attemptId:claim.attemptId,dispatchId:claim.dispatchId,...body})}

test('verified capacity terminal is mechanical no-side-effect and leaves provider choice to caller',()=>{const {claim,resultPath}=setup(617);fs.writeFileSync(resultPath,result(claim,{status:88,stdout:'',stderr:'PINO_TOOL_LAUNCH_JSON='+JSON.stringify({state:'TERMINAL',exit_class:'CAPACITY_EXHAUSTED'})}));const r=statusCodexReview({key:claim.obligationKey});assert.equal(r.state,'NO_SIDE_EFFECT');assert.equal(r.noSideEffectEvidence.reason,'CAPACITY_EXHAUSTED_VERIFIED')});

test('capacity marker with non-capacity outer status does not authorize reclaim',()=>{const {claim,resultPath}=setup(618);fs.writeFileSync(resultPath,result(claim,{status:90,stdout:'',stderr:'PINO_TOOL_LAUNCH_JSON='+JSON.stringify({state:'TERMINAL',exit_class:'CAPACITY_EXHAUSTED'})+'\nERROR: capacity source verification failed'}));const r=statusCodexReview({key:claim.obligationKey});assert.equal(r.state,'TERMINAL');assert.equal(r.result.errorAfterStart,true)});

test('verified Codex result closes the exact claim without selecting a next action',()=>{const {claim,resultPath}=setup(619),verified={codexDirectReviewVerified:true,repository:claim.binding.repository,pr_number:claim.binding.prNumber,review_kind:'INDIE',candidate:claim.binding.candidate,verdict:'PASS',p0:0,p1:0,blocking_findings:[],reviewAuthorityPath:'/tmp/a.json'};fs.writeFileSync(resultPath,result(claim,{status:0,stdout:JSON.stringify(verified)+'\n',stderr:'PINO_TOOL_LAUNCH_JSON='+JSON.stringify({state:'TERMINAL',exit_class:'SUCCESS'})}));const r=statusCodexReview({key:claim.obligationKey});assert.equal(r.state,'TERMINAL');assert.equal(r.result.verified.verdict,'PASS');assert.equal('nextAction' in r,false)});

test('reserved dispatch never causes a second launch and waits for exact attempt result',()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'review-codex-reserved-'));process.env.PINO_REVIEW_TOOL_STATE_DIR=path.join(root,'state');process.env.PINO_REVIEW_CODEX_STATE_DIR=path.join(root,'codex');const binding={reviewKind:'INDIE',repository:'vmtct/pino-team-os',prNumber:620,candidate:'c'.repeat(40)},claim=claimReview(binding,'CODEX'),reserved=reserveReviewDispatch(claim.obligationKey,'CODEX');const r=statusCodexReview({key:reserved.obligationKey});assert.equal(r.state,'DISPATCH_RESERVED');assert.equal(r.reconciliationRequired,true)});
