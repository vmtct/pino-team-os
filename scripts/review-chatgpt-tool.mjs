#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';
import {inspectReview,markReviewStarted,markReviewUncertain,markReviewNoSideEffect,markReviewTerminal} from './review-tool-state.mjs';

const DEFAULT_GATEWAY='http://127.0.0.1:9461';
const DEFAULT_TOKEN='D:/pino-cache/controller/pac/gateway.token';
const PROJECT_ID='g-p-6aa207a6f9688191a2ba5bcccebca4d7';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const canonical=s=>String(s??'').replace(/\r\n/g,'\n').replace(/\r/g,'\n').trim();
const identity=s=>canonical(s).replace(/\u00a0/g,' ').replace(/[\u200b-\u200d\ufeff]/gi,'').split('\n').map(x=>x.replace(/[ \t]+$/,'')).join('\n').replace(/\n{2,}/g,'\n');
const sha=s=>crypto.createHash('sha256').update(identity(s)).digest('hex');
const safeLabel=s=>{const x=String(s||'').trim();if(!/^[A-Za-z0-9_.:-]{1,120}$/.test(x))throw new Error('REVIEW_CHATGPT_LABEL_INVALID');return x};
function token(){return String(process.env.PINO_PAC_GATEWAY_TOKEN||fs.readFileSync(process.env.PINO_PAC_GATEWAY_TOKEN_FILE||DEFAULT_TOKEN,'utf8')).trim();}
async function request(route,{method='GET',body}={}){const base=process.env.PINO_PAC_GATEWAY||DEFAULT_GATEWAY;const r=await fetch(base+route,{method,headers:{authorization:`Bearer ${token()}`,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const t=await r.text();let j;try{j=JSON.parse(t)}catch{j={raw:t}};if(!r.ok)throw new Error(`PAC_GATEWAY_HTTP_${r.status}:${j.error??t}`);return j;}
function receiptOf(state){if(!state?.receipt)return null;let evidence={};const raw=String(state.receipt.evidence_json??'');try{evidence=raw?JSON.parse(raw):{}}catch{evidence={raw}};return {outcome:state.receipt.outcome,evidence,receiptId:state.receipt.receipt_id??null,createdAt:state.receipt.created_at??null,evidenceHash:crypto.createHash('sha256').update(raw).digest('hex')};}
async function waitReceipt(actionId,timeoutMs){const deadline=Date.now()+timeoutMs;while(Date.now()<deadline){const r=receiptOf(await request('/v1/actions/'+encodeURIComponent(actionId)));if(r)return {actionId,...r};await sleep(250)}return {actionId,outcome:'TIMEOUT_UNCERTAIN',evidence:{reason:'ACTION_RECEIPT_TIMEOUT',actionId}};}
async function submit(intent,timeoutMs){const x=await request('/v1/intents',{method:'POST',body:{schemaVersion:1,...intent}});return waitReceipt(x.actionId,timeoutMs);}
const isNoSideEffect=r=>r.outcome==='NOT_STARTED'||r.evidence?.writeAttempted===false||r.evidence?.safeNoWrite===true||r.evidence?.phase==='PRE_EFFECT';
function startHandle(result,record,promptSha256,reviewKey){const e=result.evidence??{};if(!e.conversationId||e.candidate!==record.binding.candidate||e.promptSha256!==promptSha256||!String(e.url??'').includes('/c/'+e.conversationId))throw new Error('REVIEW_CHATGPT_START_RECEIPT_BINDING_INVALID');return {provider:'CHATGPT',actionId:result.actionId,receiptId:result.receiptId,receiptEvidenceHash:result.evidenceHash,conversationId:e.conversationId,url:e.url,targetId:e.targetId??null,promptSha256,reviewKey};}
async function resolveStartReceipt(record,result,promptSha256,reviewKey){if(result.outcome==='CONFIRMED'){const handle=startHandle(result,record,promptSha256,reviewKey);return markReviewStarted(record.obligationKey,'CHATGPT',handle)}if(isNoSideEffect(result))return markReviewNoSideEffect(record.obligationKey,'CHATGPT',{operation:'CHATGPT_AUDIT_START',...result});return markReviewUncertain(record.obligationKey,'CHATGPT',{operation:'CHATGPT_AUDIT_START',...result,promptSha256,reviewKey});}
function assertAuditBinding(a,b){if(!a||String(a.repository||'').toLowerCase()!==b.repository||Number(a.pr_number)!==b.prNumber||String(a.review_kind||'').toUpperCase()!==b.reviewKind||String(a.candidate||'').toLowerCase()!==b.candidate)throw new Error('REVIEW_CHATGPT_RESULT_BINDING_INVALID');}

export async function startChatgptReview({key,promptPath,label,timeoutMs=300000}){
  const record=inspectReview(key);if(record.provider!=='CHATGPT')throw new Error('REVIEW_CHATGPT_PROVIDER_NOT_CLAIMED');
  if(record.state==='START_CONFIRMED'||record.state==='TERMINAL'||record.state==='CONSUMED')return {...record,idempotent:true};
  const text=canonical(fs.readFileSync(promptPath,'utf8').replace(/^\uFEFF/,''));if(text.length<200)throw new Error('REVIEW_CHATGPT_PROMPT_TOO_SHORT');const promptSha256=sha(text),reviewKey=record.obligationKey.slice(0,40),safe=safeLabel(label);
  if(record.state==='UNCERTAIN_DISPATCH'){
    const prior=record.uncertainEvidence;if(prior?.actionId){const resolved=await waitReceipt(prior.actionId,Math.min(timeoutMs,120000));if(resolved.outcome!=='TIMEOUT_UNCERTAIN')return resolveStartReceipt(record,resolved,promptSha256,reviewKey)}
    return {...record,idempotent:true,reconciliationRequired:true};
  }
  if(record.state!=='CLAIMED')throw new Error('REVIEW_CHATGPT_START_STATE_INVALID:'+record.state);
  const result=await submit({action:'chatgpt.audit.start',target:{project:'Audit',reviewKey},payload:{projectId:PROJECT_ID,label:safe,candidate:record.binding.candidate,prompt:text,promptSha256,reviewKey},priority:2,maxRetries:0,idempotencyKey:`review-tool/chatgpt/start/${record.obligationKey}/${record.attemptId}`},timeoutMs);
  return resolveStartReceipt(record,result,promptSha256,reviewKey);
}

export async function statusChatgptReview({key,timeoutMs=120000}){
  const record=inspectReview(key);if(record.provider!=='CHATGPT')throw new Error('REVIEW_CHATGPT_PROVIDER_NOT_CLAIMED');if(record.state==='UNCERTAIN_DISPATCH')throw new Error('REVIEW_CHATGPT_START_RECONCILE_REQUIRED');if(record.state==='TERMINAL'||record.state==='CONSUMED')return {...record,idempotent:true};if(record.state!=='START_CONFIRMED')throw new Error('REVIEW_CHATGPT_STATUS_STATE_INVALID:'+record.state);
  const h=record.handle,result=await submit({action:'chatgpt.audit.status',target:{project:'Audit',reviewKey:h.reviewKey},payload:{conversationId:h.conversationId,candidate:record.binding.candidate,promptSha256:h.promptSha256,reviewKey:h.reviewKey,preferredTargetId:h.targetId},priority:3,maxRetries:0,idempotencyKey:`review-tool/chatgpt/status/${record.obligationKey}/${crypto.randomUUID()}`},timeoutMs);
  if(result.outcome!=='CONFIRMED')return {ok:false,...result};const e=result.evidence;if(e.conversationId!==h.conversationId||e.candidate!==record.binding.candidate||e.promptSha256!==h.promptSha256)throw new Error('REVIEW_CHATGPT_STATUS_RECEIPT_BINDING_INVALID');if(e.terminal===true&&e.auditResult){assertAuditBinding(e.auditResult,record.binding);return markReviewTerminal(key,'CHATGPT',{provider:'CHATGPT',auditResult:e.auditResult,statusActionId:result.actionId,statusReceiptId:result.receiptId,statusEvidenceHash:result.evidenceHash});}return {ok:true,state:'RUNNING',busy:e.busy===true,terminal:false,conversationId:h.conversationId,terminalReason:e.terminalReason??null};
}

export async function continueChatgptReview({key}){const record=inspectReview(key);if(record.provider!=='CHATGPT'||record.state!=='START_CONFIRMED')throw new Error('REVIEW_CHATGPT_CONTINUE_STATE_INVALID');throw new Error('REVIEW_CHATGPT_CONTINUE_UNSUPPORTED_BY_STATUS_CONTRACT');}
export async function closeChatgptReview({key,timeoutMs=120000}){const record=inspectReview(key);if(record.provider!=='CHATGPT')throw new Error('REVIEW_CHATGPT_PROVIDER_NOT_CLAIMED');const id=record.handle?.conversationId;if(!id)return {ok:true,skipped:true,reason:'NO_CONFIRMED_CONVERSATION'};return submit({action:'chatgpt.audit.close',target:{project:'Audit',reviewKey:record.handle.reviewKey},payload:{conversationId:id},priority:4,maxRetries:0,idempotencyKey:`review-tool/chatgpt/close/${record.obligationKey}/${id}`},timeoutMs);}

async function main(){const a=process.argv.slice(2),cmd=a.shift(),v=n=>{const i=a.indexOf(n);if(i<0||i===a.length-1)throw new Error('ARG_REQUIRED:'+n);return a[i+1]},opts={key:v('--key')};let out;if(cmd==='start')out=await startChatgptReview({...opts,promptPath:v('--prompt'),label:v('--label')});else if(cmd==='status')out=await statusChatgptReview(opts);else if(cmd==='continue')out=await continueChatgptReview(opts);else if(cmd==='close')out=await closeChatgptReview(opts);else throw new Error('USAGE: review-chatgpt-tool.mjs start|status|continue|close ...');console.log(JSON.stringify(out,null,2));}
if(import.meta.url===new URL(`file://${process.argv[1]?.replaceAll('\\','/')}`).href)main().catch(e=>{console.error('ERROR: '+e.message);process.exitCode=1});
