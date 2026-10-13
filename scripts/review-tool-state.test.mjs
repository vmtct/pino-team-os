import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {claimReview,markReviewStarted,markReviewNoSideEffect,markReviewTerminal,consumeReview,inspectReview} from './review-tool-state.mjs';

const candidate='a'.repeat(40),binding={reviewKind:'INDIE',repository:'vmtct/pino-team-os',prNumber:617,candidate};
function root(){const p=fs.mkdtempSync(path.join(os.tmpdir(),'review-tool-state-'));process.env.PINO_REVIEW_TOOL_STATE_DIR=p;return p}

test('exact candidate claim prevents a second provider until proved no-side-effect',()=>{root();const a=claimReview(binding,'CODEX');assert.equal(a.state,'CLAIMED');assert.throws(()=>claimReview(binding,'CHATGPT'),/ALREADY_CLAIMED/);markReviewStarted(a.obligationKey,'CODEX',{pid:12});markReviewNoSideEffect(a.obligationKey,'CODEX',{reason:'CAPACITY_EXHAUSTED'});const b=claimReview(binding,'CHATGPT',{reclaimNoSideEffect:true});assert.equal(b.provider,'CHATGPT');assert.equal(b.attemptNo,2);assert.equal(b.reclaimed,true)});

test('confirmed substantive result permanently closes same exact obligation',()=>{root();const a=claimReview(binding,'CHATGPT');markReviewStarted(a.obligationKey,'CHATGPT',{conversationId:'x'});markReviewTerminal(a.obligationKey,'CHATGPT',{verdict:'PASS'});consumeReview(a.obligationKey,'CHATGPT');assert.equal(inspectReview(a.obligationKey).state,'CONSUMED');assert.throws(()=>claimReview(binding,'CODEX',{reclaimNoSideEffect:true}),/ALREADY_CLAIMED/)});

test('same provider claim is idempotent and exact binding is immutable',()=>{root();const a=claimReview(binding,'CODEX'),again=claimReview(binding,'CODEX');assert.equal(again.idempotent,true);assert.equal(again.attemptId,a.attemptId);const other=claimReview({...binding,candidate:'b'.repeat(40)},'CODEX');assert.notEqual(other.obligationKey,a.obligationKey)});
