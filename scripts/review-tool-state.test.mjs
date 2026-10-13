import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {claimReview,reserveReviewDispatch,markReviewStarted,markReviewNoSideEffect,markReviewTerminal,recoverCodexPrelaunchNoSideEffect,consumeReview,inspectReview} from './review-tool-state.mjs';

const candidate='a'.repeat(40),binding={reviewKind:'INDIE',repository:'vmtct/pino-team-os',prNumber:617,candidate};
function root(){const p=fs.mkdtempSync(path.join(os.tmpdir(),'review-tool-state-'));process.env.PINO_REVIEW_TOOL_STATE_DIR=p;return p}

test('exact candidate claim prevents a second provider until proved no-side-effect',()=>{root();const a=claimReview(binding,'CODEX');assert.equal(a.state,'CLAIMED');assert.throws(()=>claimReview(binding,'CHATGPT'),/ALREADY_CLAIMED/);const reserved=reserveReviewDispatch(a.obligationKey,'CODEX');markReviewStarted(a.obligationKey,'CODEX',{pid:12,dispatchId:reserved.dispatchId},reserved.dispatchId);markReviewNoSideEffect(a.obligationKey,'CODEX',{reason:'CAPACITY_EXHAUSTED_VERIFIED'});const b=claimReview(binding,'CHATGPT',{reclaimNoSideEffect:true});assert.equal(b.provider,'CHATGPT');assert.equal(b.attemptNo,2);assert.equal(b.reclaimed,true)});

test('confirmed substantive result permanently closes same exact obligation',()=>{root();const a=claimReview(binding,'CHATGPT');markReviewStarted(a.obligationKey,'CHATGPT',{conversationId:'x'});markReviewTerminal(a.obligationKey,'CHATGPT',{verdict:'PASS'});consumeReview(a.obligationKey,'CHATGPT');assert.equal(inspectReview(a.obligationKey).state,'CONSUMED');assert.throws(()=>claimReview(binding,'CODEX',{reclaimNoSideEffect:true}),/ALREADY_CLAIMED/)});

test('same provider claim is idempotent and exact binding is immutable',()=>{root();const a=claimReview(binding,'CODEX'),again=claimReview(binding,'CODEX');assert.equal(again.idempotent,true);assert.equal(again.attemptId,a.attemptId);const other=claimReview({...binding,candidate:'b'.repeat(40)},'CODEX');assert.notEqual(other.obligationKey,a.obligationKey)});

test('Codex dispatch reservation is atomic and exact before start',()=>{root();const a=claimReview(binding,'CODEX'),r1=reserveReviewDispatch(a.obligationKey,'CODEX'),r2=reserveReviewDispatch(a.obligationKey,'CODEX');assert.equal(r2.dispatchId,r1.dispatchId);assert.throws(()=>markReviewStarted(a.obligationKey,'CODEX',{pid:7},'00000000-0000-0000-0000-000000000000'),/START_DISPATCH_INVALID/);const started=markReviewStarted(a.obligationKey,'CODEX',{pid:7,dispatchId:r1.dispatchId},r1.dispatchId);assert.equal(started.state,'START_CONFIRMED')});

test('parseable malformed persisted state fails closed instead of reopening',()=>{const dir=root(),a=claimReview(binding,'CODEX'),p=path.join(dir,a.obligationKey+'.json');fs.writeFileSync(p,'null\n');assert.throws(()=>inspectReview(a.obligationKey),/STATE_RECORD_INVALID/);assert.throws(()=>claimReview(binding,'CODEX'),/STATE_RECORD_INVALID/)});

test('tampered no-side-effect evidence hash fails closed before reclaim',()=>{const dir=root(),a=claimReview(binding,'CODEX'),r=reserveReviewDispatch(a.obligationKey,'CODEX');markReviewStarted(a.obligationKey,'CODEX',{pid:8,dispatchId:r.dispatchId},r.dispatchId);markReviewNoSideEffect(a.obligationKey,'CODEX',{reason:'VERIFIED'});const p=path.join(dir,a.obligationKey+'.json'),j=JSON.parse(fs.readFileSync(p,'utf8'));j.noSideEffectEvidence={reason:'FORGED'};fs.writeFileSync(p,JSON.stringify(j));assert.throws(()=>claimReview(binding,'CHATGPT',{reclaimNoSideEffect:true}),/NO_SIDE_EFFECT_HASH_INVALID/)});

test('recovered no-side-effect keeps the terminal result hash tamper-evident',()=>{const dir=root(),a=claimReview(binding,'CODEX'),r=reserveReviewDispatch(a.obligationKey,'CODEX');markReviewStarted(a.obligationKey,'CODEX',{pid:9,dispatchId:r.dispatchId},r.dispatchId);const result={provider:'CODEX',errorAfterStart:true,status:90,terminalLaunch:null,stderrTail:'ERROR: REVIEW_RISK_CONTRACT_UNRESOLVED:ledger:FileNotFoundError\nERROR: canonical review risk contract unresolved\n'};markReviewTerminal(a.obligationKey,'CODEX',result);const current=inspectReview(a.obligationKey),stderrSha256=crypto.createHash('sha256').update(result.stderrTail).digest('hex');recoverCodexPrelaunchNoSideEffect(a.obligationKey,{reason:'PRELAUNCH_RISK_ADMISSION_FAILED',resultHash:current.resultHash,stderrSha256,status:90});const p=path.join(dir,a.obligationKey+'.json'),j=JSON.parse(fs.readFileSync(p,'utf8'));j.result.stderrTail+='tampered';fs.writeFileSync(p,JSON.stringify(j));assert.throws(()=>inspectReview(a.obligationKey),/RECOVERED_RESULT_HASH_INVALID/)});
