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
function readJson(p){
  if(!fs.existsSync(p))return {exists:false,value:null};
  let value;
  try{value=JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));}
  catch{throw new Error('REVIEW_TOOL_STATE_JSON_INVALID');}
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('REVIEW_TOOL_STATE_RECORD_INVALID');
  return {exists:true,value};
}
function atomicWrite(p,value){fs.mkdirSync(path.dirname(p),{recursive:true});const tmp=p+'.tmp-'+process.pid+'-'+crypto.randomUUID();fs.writeFileSync(tmp,JSON.stringify(value,null,2)+'\n');fs.renameSync(tmp,p);}
function withLock(key,fn){
  const lp=lockPath(key);fs.mkdirSync(path.dirname(lp),{recursive:true});const deadline=Date.now()+LOCK_TIMEOUT_MS;let fd;
  while(fd===undefined){try{fd=fs.openSync(lp,'wx');fs.writeFileSync(fd,JSON.stringify({pid:process.pid,at:now()}));}catch(e){if(e.code!=='EEXIST')throw e;if(Date.now()>=deadline)throw new Error('REVIEW_TOOL_LOCK_TIMEOUT');sleepSync(40);}}
  try{return fn();}finally{try{fs.closeSync(fd)}catch{};try{fs.unlinkSync(lp)}catch{}}
}
function assertProvider(provider){const p=String(provider||'').trim().toUpperCase();if(!['CODEX','CHATGPT'].includes(p))throw new Error('REVIEW_TOOL_PROVIDER_INVALID');return p;}
function assertExact(record,binding,key){if(!record||record.obligationKey!==key||digest(record.binding)!==digest(binding))throw new Error('REVIEW_TOOL_BINDING_MISMATCH');}
function validateRecord(record,key){
  if(record.schemaVersion!==1||record.kind!=='PINO_REVIEW_TOOL_CLAIM')throw new Error('REVIEW_TOOL_STATE_SCHEMA_INVALID');
  const binding=normalizeBinding(record.binding);
  if(record.obligationKey!==key||obligationKey(binding)!==key||digest(binding)!==digest(record.binding))throw new Error('REVIEW_TOOL_BINDING_MISMATCH');
  const provider=assertProvider(record.provider);
  const states=new Set(['CLAIMED','DISPATCH_RESERVED','START_CONFIRMED','UNCERTAIN_DISPATCH','NO_SIDE_EFFECT','TERMINAL','CONSUMED']);
  if(!states.has(record.state))throw new Error('REVIEW_TOOL_STATE_INVALID');
  if(!/^[0-9a-f-]{36}$/i.test(String(record.attemptId||''))||!Number.isInteger(record.attemptNo)||record.attemptNo<1)throw new Error('REVIEW_TOOL_ATTEMPT_INVALID');
  if(record.state==='DISPATCH_RESERVED'&&!/^[0-9a-f-]{36}$/i.test(String(record.dispatchId||'')))throw new Error('REVIEW_TOOL_DISPATCH_INVALID');
  if(record.state==='START_CONFIRMED'&&record.handleHash!==digest(record.handle))throw new Error('REVIEW_TOOL_HANDLE_HASH_INVALID');
  if(record.state==='UNCERTAIN_DISPATCH'&&record.uncertainEvidenceHash!==digest(record.uncertainEvidence))throw new Error('REVIEW_TOOL_UNCERTAIN_HASH_INVALID');
  if(record.state==='NO_SIDE_EFFECT'&&record.noSideEffectEvidenceHash!==digest(record.noSideEffectEvidence))throw new Error('REVIEW_TOOL_NO_SIDE_EFFECT_HASH_INVALID');
  if(record.state==='NO_SIDE_EFFECT'&&record.recoveredFromTerminalResultHash){const stderr=String(record.result?.stderrTail??''),stderrSha256=crypto.createHash('sha256').update(stderr).digest('hex');if(record.resultHash!==digest(record.result)||record.recoveredFromTerminalResultHash!==record.resultHash||record.noSideEffectEvidence?.resultHash!==record.resultHash||record.noSideEffectEvidence?.stderrSha256!==stderrSha256)throw new Error('REVIEW_TOOL_RECOVERED_RESULT_HASH_INVALID');}
  if(['TERMINAL','CONSUMED'].includes(record.state)&&record.resultHash!==digest(record.result))throw new Error('REVIEW_TOOL_RESULT_HASH_INVALID');
  return {...record,binding,provider};
}
function loadRecord(p,key,{allowMissing=false}={}){const x=readJson(p);if(!x.exists){if(allowMissing)return null;throw new Error('REVIEW_TOOL_CLAIM_NOT_FOUND');}return validateRecord(x.value,key);}
function archiveAttempt(key,record){const dir=path.join(ROOT(),'archive');fs.mkdirSync(dir,{recursive:true});const p=path.join(dir,`${key}-${Date.now()}-${record.attemptId}.json`);atomicWrite(p,record);return p;}

export function claimReview(bindingInput,providerInput,{reclaimNoSideEffect=false}={}){
  const binding=normalizeBinding(bindingInput),provider=assertProvider(providerInput),key=obligationKey(binding);
  return withLock(key,()=>{const p=recordPath(key),existing=loadRecord(p,key,{allowMissing:true});
    if(existing){assertExact(existing,binding,key);
      if(existing.state==='NO_SIDE_EFFECT'&&reclaimNoSideEffect){const archivePath=archiveAttempt(key,existing);const next={schemaVersion:1,kind:'PINO_REVIEW_TOOL_CLAIM',obligationKey:key,binding,provider,state:'CLAIMED',attemptId:crypto.randomUUID(),attemptNo:Number(existing.attemptNo||1)+1,createdAt:now(),updatedAt:now(),reclaimedFrom:{provider:existing.provider,attemptId:existing.attemptId,archivePath,noSideEffectEvidenceHash:existing.noSideEffectEvidenceHash}};atomicWrite(p,next);return {...validateRecord(next,key),idempotent:false,reclaimed:true};}
      if(existing.provider===provider)return {...existing,idempotent:true};
      throw new Error(`REVIEW_TOOL_ALREADY_CLAIMED:${existing.provider}:${existing.state}`);
    }
    const record={schemaVersion:1,kind:'PINO_REVIEW_TOOL_CLAIM',obligationKey:key,binding,provider,state:'CLAIMED',attemptId:crypto.randomUUID(),attemptNo:1,createdAt:now(),updatedAt:now()};atomicWrite(p,record);return {...validateRecord(record,key),idempotent:false};
  });
}

function mutate(key,providerInput,fn){const provider=assertProvider(providerInput);if(!/^[0-9a-f]{64}$/.test(String(key)))throw new Error('REVIEW_TOOL_KEY_INVALID');return withLock(key,()=>{const p=recordPath(key),record=loadRecord(p,key);if(record.provider!==provider)throw new Error('REVIEW_TOOL_PROVIDER_MISMATCH');const updatedAt=now(),next={...fn(record),updatedAt};atomicWrite(p,next);return validateRecord(next,key);});}
export function reserveReviewDispatch(key,provider){return mutate(key,provider,r=>{if(r.state==='DISPATCH_RESERVED')return {...r};if(r.state!=='CLAIMED')throw new Error('REVIEW_TOOL_DISPATCH_RESERVE_STATE_INVALID:'+r.state);return {...r,state:'DISPATCH_RESERVED',dispatchId:crypto.randomUUID(),dispatchReservedAt:now()};});}
export function markReviewStarted(key,provider,handle,dispatchId=null){if(!handle||typeof handle!=='object'||Array.isArray(handle))throw new Error('REVIEW_TOOL_HANDLE_INVALID');const handleHash=digest(handle);return mutate(key,provider,r=>{if(r.state==='START_CONFIRMED'&&r.handleHash===handleHash)return {...r};if(r.provider==='CODEX'){if(r.state!=='DISPATCH_RESERVED'||!dispatchId||r.dispatchId!==dispatchId)throw new Error('REVIEW_TOOL_START_DISPATCH_INVALID');}else if(!['CLAIMED','UNCERTAIN_DISPATCH'].includes(r.state))throw new Error('REVIEW_TOOL_START_STATE_INVALID:'+r.state);return {...r,state:'START_CONFIRMED',handle,handleHash,startedAt:now()};});}
export function markReviewUncertain(key,provider,evidence){if(!evidence||typeof evidence!=='object'||Array.isArray(evidence))throw new Error('REVIEW_TOOL_UNCERTAIN_EVIDENCE_INVALID');const h=digest(evidence);return mutate(key,provider,r=>{if(r.state==='UNCERTAIN_DISPATCH'&&r.uncertainEvidenceHash===h)return {...r};if(r.state!=='CLAIMED')throw new Error('REVIEW_TOOL_UNCERTAIN_STATE_INVALID:'+r.state);return {...r,state:'UNCERTAIN_DISPATCH',uncertainEvidence:evidence,uncertainEvidenceHash:h,uncertainAt:now()};});}
export function markReviewNoSideEffect(key,provider,evidence){if(!evidence||typeof evidence!=='object'||Array.isArray(evidence))throw new Error('REVIEW_TOOL_NO_SIDE_EFFECT_EVIDENCE_INVALID');const h=digest(evidence);return mutate(key,provider,r=>{if(r.state==='NO_SIDE_EFFECT'&&r.noSideEffectEvidenceHash===h)return {...r};if(!['CLAIMED','DISPATCH_RESERVED','START_CONFIRMED','UNCERTAIN_DISPATCH'].includes(r.state))throw new Error('REVIEW_TOOL_NO_SIDE_EFFECT_STATE_INVALID:'+r.state);return {...r,state:'NO_SIDE_EFFECT',noSideEffectEvidence:evidence,noSideEffectEvidenceHash:h,noSideEffectAt:now()};});}
export function recoverCodexPrelaunchNoSideEffect(key,evidence){
  if(!evidence||typeof evidence!=='object'||Array.isArray(evidence))throw new Error('REVIEW_TOOL_PRELAUNCH_EVIDENCE_INVALID');
  return mutate(key,'CODEX',r=>{
    if(r.state==='NO_SIDE_EFFECT'&&r.noSideEffectEvidenceHash===digest(evidence))return {...r};
    if(r.state!=='TERMINAL')throw new Error('REVIEW_TOOL_PRELAUNCH_RECOVERY_STATE_INVALID:'+r.state);
    const result=r.result??{},stderr=String(result.stderrTail??'');
    const stderrSha256=crypto.createHash('sha256').update(stderr).digest('hex');
    const exactRiskFailure=Number(result.status)===90&&result.provider==='CODEX'&&result.errorAfterStart===true&&!result.verified&&result.terminalLaunch==null&&!stderr.includes('PINO_TOOL_LAUNCH_JSON=')&&stderr.includes('REVIEW_RISK_CONTRACT_UNRESOLVED:')&&stderr.includes('canonical review risk contract unresolved');
    const exactBriefFailure=Number(result.status)===1&&result.provider==='CODEX'&&result.errorAfterStart===true&&!result.verified&&result.terminalLaunch==null&&!stderr.includes('PINO_TOOL_LAUNCH_JSON=')&&stderr.includes('BRIEF_INVALID:')&&stderr.includes('Codex reviewer failed with non-capacity rc=1');
    const expectedReason=exactRiskFailure?'PRELAUNCH_RISK_ADMISSION_FAILED':exactBriefFailure?'PRELAUNCH_BRIEF_ADMISSION_FAILED':null;
    if(!expectedReason)throw new Error('REVIEW_TOOL_PRELAUNCH_RECOVERY_NOT_PROVEN');
    if(evidence.reason!==expectedReason||evidence.resultHash!==r.resultHash||evidence.stderrSha256!==stderrSha256)throw new Error('REVIEW_TOOL_PRELAUNCH_EVIDENCE_BINDING_INVALID');
    const h=digest(evidence);
    return {...r,state:'NO_SIDE_EFFECT',noSideEffectEvidence:evidence,noSideEffectEvidenceHash:h,noSideEffectAt:now(),recoveredFromTerminalResultHash:r.resultHash,recoveredFromTerminalAt:r.terminalAt};
  });
}
export function markReviewTerminal(key,provider,result){if(!result||typeof result!=='object'||Array.isArray(result))throw new Error('REVIEW_TOOL_RESULT_INVALID');const h=digest(result);return mutate(key,provider,r=>{if(r.state==='TERMINAL'&&r.resultHash===h)return {...r};if(r.state!=='START_CONFIRMED')throw new Error('REVIEW_TOOL_TERMINAL_STATE_INVALID:'+r.state);return {...r,state:'TERMINAL',result,resultHash:h,terminalAt:now()};});}
export function consumeReview(key,provider){return mutate(key,provider,r=>{if(r.state==='CONSUMED')return {...r};if(r.state!=='TERMINAL')throw new Error('REVIEW_TOOL_CONSUME_STATE_INVALID:'+r.state);return {...r,state:'CONSUMED',consumedAt:now()};});}
export function inspectReview(key){if(!/^[0-9a-f]{64}$/.test(String(key)))throw new Error('REVIEW_TOOL_KEY_INVALID');return loadRecord(recordPath(key),key);}
