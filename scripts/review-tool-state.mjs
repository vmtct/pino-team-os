import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DEFAULT_ROOT='C:/Users/ADMIN/Documents/PINO_SOP/state/review-tools';
const ROOT=()=>path.resolve(process.env.PINO_REVIEW_TOOL_STATE_DIR||DEFAULT_ROOT);
const LOCK_TIMEOUT_MS=Number(process.env.PINO_REVIEW_TOOL_LOCK_TIMEOUT_MS||15000);
const sleepSync=ms=>Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms);
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
export const digest=v=>crypto.createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
const now=()=>new Date().toISOString();

export function normalizeBinding(input){
  const reviewKind=String(input?.reviewKind||'').trim().toUpperCase();
  const repository=String(input?.repository||'').trim().toLowerCase();
  const prNumber=Number(input?.prNumber);
  const candidate=String(input?.candidate||'').trim().toLowerCase();
  if(!/^[A-Z][A-Z0-9_:-]{1,63}$/.test(reviewKind))throw new Error('REVIEW_TOOL_KIND_INVALID');
  if(!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/.test(repository))throw new Error('REVIEW_TOOL_REPOSITORY_INVALID');
  if(!Number.isInteger(prNumber)||prNumber<1)throw new Error('REVIEW_TOOL_PR_INVALID');
  if(!/^[0-9a-f]{40}$/.test(candidate))throw new Error('REVIEW_TOOL_CANDIDATE_INVALID');
  return {reviewKind,repository,prNumber,candidate};
}
export function obligationKey(binding){return digest({schemaVersion:1,kind:'PINO_REVIEW_TOOL_OBLIGATION',...normalizeBinding(binding)});}
function recordPath(key){return path.join(ROOT(),key+'.json');}
function lockPath(key){return path.join(ROOT(),'.locks',key+'.lock');}
function readJson(p){return fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'')):null;}
function atomicWrite(p,value){fs.mkdirSync(path.dirname(p),{recursive:true});const tmp=p+'.tmp-'+process.pid+'-'+crypto.randomUUID();fs.writeFileSync(tmp,JSON.stringify(value,null,2)+'\n');fs.renameSync(tmp,p);}
function withLock(key,fn){
  const lp=lockPath(key);fs.mkdirSync(path.dirname(lp),{recursive:true});const deadline=Date.now()+LOCK_TIMEOUT_MS;let fd;
  while(fd===undefined){try{fd=fs.openSync(lp,'wx');fs.writeFileSync(fd,JSON.stringify({pid:process.pid,at:now()}));}catch(e){if(e.code!=='EEXIST')throw e;if(Date.now()>=deadline)throw new Error('REVIEW_TOOL_LOCK_TIMEOUT');sleepSync(40);}}
  try{return fn();}finally{try{fs.closeSync(fd)}catch{};try{fs.unlinkSync(lp)}catch{}}
}
function assertProvider(provider){const p=String(provider||'').trim().toUpperCase();if(!['CODEX','CHATGPT'].includes(p))throw new Error('REVIEW_TOOL_PROVIDER_INVALID');return p;}
function assertExact(record,binding,key){if(!record||record.obligationKey!==key||digest(record.binding)!==digest(binding))throw new Error('REVIEW_TOOL_BINDING_MISMATCH');}
function archiveAttempt(key,record){const dir=path.join(ROOT(),'archive');fs.mkdirSync(dir,{recursive:true});const p=path.join(dir,`${key}-${Date.now()}-${record.attemptId}.json`);atomicWrite(p,record);return p;}

export function claimReview(bindingInput,providerInput,{reclaimNoSideEffect=false}={}){
  const binding=normalizeBinding(bindingInput),provider=assertProvider(providerInput),key=obligationKey(binding);
  return withLock(key,()=>{const p=recordPath(key),existing=readJson(p);
    if(existing){assertExact(existing,binding,key);
      if(existing.state==='NO_SIDE_EFFECT'&&reclaimNoSideEffect){const archivePath=archiveAttempt(key,existing);const next={schemaVersion:1,kind:'PINO_REVIEW_TOOL_CLAIM',obligationKey:key,binding,provider,state:'CLAIMED',attemptId:crypto.randomUUID(),attemptNo:Number(existing.attemptNo||1)+1,createdAt:now(),updatedAt:now(),reclaimedFrom:{provider:existing.provider,attemptId:existing.attemptId,archivePath,noSideEffectEvidenceHash:existing.noSideEffectEvidenceHash}};atomicWrite(p,next);return {...next,idempotent:false,reclaimed:true};}
      if(existing.provider===provider)return {...existing,idempotent:true};
      throw new Error(`REVIEW_TOOL_ALREADY_CLAIMED:${existing.provider}:${existing.state}`);
    }
    const record={schemaVersion:1,kind:'PINO_REVIEW_TOOL_CLAIM',obligationKey:key,binding,provider,state:'CLAIMED',attemptId:crypto.randomUUID(),attemptNo:1,createdAt:now(),updatedAt:now()};atomicWrite(p,record);return {...record,idempotent:false};
  });
}

function mutate(key,providerInput,fn){const provider=assertProvider(providerInput);if(!/^[0-9a-f]{64}$/.test(String(key)))throw new Error('REVIEW_TOOL_KEY_INVALID');return withLock(key,()=>{const p=recordPath(key),record=readJson(p);if(!record)throw new Error('REVIEW_TOOL_CLAIM_NOT_FOUND');if(record.provider!==provider)throw new Error('REVIEW_TOOL_PROVIDER_MISMATCH');const next=fn(record);atomicWrite(p,{...next,updatedAt:now()});return {...next,updatedAt:now()};});}
export function markReviewStarted(key,provider,handle){if(!handle||typeof handle!=='object'||Array.isArray(handle))throw new Error('REVIEW_TOOL_HANDLE_INVALID');const handleHash=digest(handle);return mutate(key,provider,r=>{if(r.state==='START_CONFIRMED'&&r.handleHash===handleHash)return {...r,idempotent:true};if(!['CLAIMED','UNCERTAIN_DISPATCH'].includes(r.state))throw new Error('REVIEW_TOOL_START_STATE_INVALID:'+r.state);return {...r,state:'START_CONFIRMED',handle,handleHash,startedAt:now(),idempotent:false};});}
export function markReviewUncertain(key,provider,evidence){if(!evidence||typeof evidence!=='object'||Array.isArray(evidence))throw new Error('REVIEW_TOOL_UNCERTAIN_EVIDENCE_INVALID');const h=digest(evidence);return mutate(key,provider,r=>{if(r.state==='UNCERTAIN_DISPATCH'&&r.uncertainEvidenceHash===h)return {...r,idempotent:true};if(r.state!=='CLAIMED')throw new Error('REVIEW_TOOL_UNCERTAIN_STATE_INVALID:'+r.state);return {...r,state:'UNCERTAIN_DISPATCH',uncertainEvidence:evidence,uncertainEvidenceHash:h,uncertainAt:now(),idempotent:false};});}
export function markReviewNoSideEffect(key,provider,evidence){if(!evidence||typeof evidence!=='object'||Array.isArray(evidence))throw new Error('REVIEW_TOOL_NO_SIDE_EFFECT_EVIDENCE_INVALID');const h=digest(evidence);return mutate(key,provider,r=>{if(r.state==='NO_SIDE_EFFECT'&&r.noSideEffectEvidenceHash===h)return {...r,idempotent:true};if(!['CLAIMED','START_CONFIRMED','UNCERTAIN_DISPATCH'].includes(r.state))throw new Error('REVIEW_TOOL_NO_SIDE_EFFECT_STATE_INVALID:'+r.state);return {...r,state:'NO_SIDE_EFFECT',noSideEffectEvidence:evidence,noSideEffectEvidenceHash:h,noSideEffectAt:now(),idempotent:false};});}
export function markReviewTerminal(key,provider,result){if(!result||typeof result!=='object'||Array.isArray(result))throw new Error('REVIEW_TOOL_RESULT_INVALID');const h=digest(result);return mutate(key,provider,r=>{if(r.state==='TERMINAL'&&r.resultHash===h)return {...r,idempotent:true};if(r.state!=='START_CONFIRMED')throw new Error('REVIEW_TOOL_TERMINAL_STATE_INVALID:'+r.state);return {...r,state:'TERMINAL',result,resultHash:h,terminalAt:now(),idempotent:false};});}
export function consumeReview(key,provider){return mutate(key,provider,r=>{if(r.state==='CONSUMED')return {...r,idempotent:true};if(r.state!=='TERMINAL')throw new Error('REVIEW_TOOL_CONSUME_STATE_INVALID:'+r.state);return {...r,state:'CONSUMED',consumedAt:now(),idempotent:false};});}
export function inspectReview(key){if(!/^[0-9a-f]{64}$/.test(String(key)))throw new Error('REVIEW_TOOL_KEY_INVALID');const r=readJson(recordPath(key));if(!r)throw new Error('REVIEW_TOOL_CLAIM_NOT_FOUND');return r;}
