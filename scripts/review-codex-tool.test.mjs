import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {claimReview,markReviewStarted} from './review-tool-state.mjs';
import {statusCodexReview} from './review-codex-tool.mjs';

function setup(pr){const root=fs.mkdtempSync(path.join(os.tmpdir(),'review-codex-'));process.env.PINO_REVIEW_TOOL_STATE_DIR=path.join(root,'state');process.env.PINO_REVIEW_CODEX_STATE_DIR=path.join(root,'codex');const binding={reviewKind:'INDIE',repository:'vmtct/pino-team-os',prNumber:pr,candidate:String(pr).padStart(40,'b').slice(-40)},claim=claimReview(binding,'CODEX'),resultPath=path.join(root,'result.json');markReviewStarted(claim.obligationKey,'CODEX',{workerPid:999999,resultPath});return {root,claim,resultPath}}

test('capacity terminal is mechanical no-side-effect and leaves provider choice to caller',()=>{const {claim,resultPath}=setup(617);fs.writeFileSync(resultPath,JSON.stringify({status:88,stdout:'',stderr:'PINO_TOOL_LAUNCH_JSON='+JSON.stringify({state:'TERMINAL',exit_class:'CAPACITY_EXHAUSTED'})}));const r=statusCodexReview({key:claim.obligationKey});assert.equal(r.state,'NO_SIDE_EFFECT');assert.equal(r.noSideEffectEvidence.reason,'CAPACITY_EXHAUSTED')});

test('verified Codex result closes the exact claim without selecting a next action',()=>{const {claim,resultPath}=setup(618),verified={codexDirectReviewVerified:true,repository:claim.binding.repository,pr_number:claim.binding.prNumber,review_kind:'INDIE',candidate:claim.binding.candidate,verdict:'PASS',p0:0,p1:0,blocking_findings:[],reviewAuthorityPath:'/tmp/a.json'};fs.writeFileSync(resultPath,JSON.stringify({status:0,stdout:JSON.stringify(verified)+'\n',stderr:'PINO_TOOL_LAUNCH_JSON='+JSON.stringify({state:'TERMINAL',exit_class:'SUCCESS'})}));const r=statusCodexReview({key:claim.obligationKey});assert.equal(r.state,'TERMINAL');assert.equal(r.result.verified.verdict,'PASS');assert.equal('nextAction' in r,false)});
