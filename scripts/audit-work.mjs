import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync,spawn} from 'node:child_process';
import {validateReviewChainShortActivation,validateOriginalCodexAuthority} from './review-chain-short-policy.mjs';

const ROOT=process.env.PINO_SOP_ROOT??'C:/Users/ADMIN/Documents/PINO_SOP';
const MASTER=ROOT+'/state/audit-work-master.json';
const MANUAL_AUDIT_MASTER=ROOT+'/state/manual-audit-master.json';
const AUDIT_TOOL=ROOT+'/tools/pino-chatgpt-audit.mjs';
const DEV_WORK=ROOT+'/tools/dev-work.mjs';
const NOTIFIER=ROOT+'/tools/rc-defect-f2-notifier.mjs';
const AUDIT_PROJECT_ID='g-p-6aa207a6f9688191a2ba5bcccebca4d7';
const CODEX_FALLBACK_MAX_AGE_MS=60*60*1000;
const INDIE_FULL_AXIS_SWEEP_V1=["DOMAIN_STATE_LIFECYCLE","AUTHORITY_SECURITY","PERSISTENCE_MIGRATION","CONCURRENCY_ATOMICITY","REPLAY_IDEMPOTENCY","RECOVERY_ROLLBACK_CLEANUP","CROSS_BOUNDARY_INTEGRATION","CI_RELEASE_PRODUCTION_CONTROL","ADJACENT_SIBLING_PATHS","COMPATIBILITY_HISTORICAL_STATE"];
const now=()=>new Date().toISOString();
const read=(f,fb=null)=>{try{return JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));}catch{return fb;}};
function atomic(f,v){
  fs.mkdirSync(path.dirname(f),{recursive:true});
  const payload=JSON.stringify(v,null,2)+'\n';
  const t=f+'.tmp-'+process.pid+'-'+Date.now();
  fs.writeFileSync(t,payload);
  let last=null;
  for(let attempt=0;attempt<8;attempt++){
    try{fs.renameSync(t,f);return;}
    catch(error){
      last=error;
      if(!['EPERM','EBUSY','EACCES'].includes(error?.code))break;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,50*(attempt+1));
    }
  }
  if(last&&['EPERM','EBUSY','EACCES'].includes(last?.code)){
    let fd=null;
    try{
      fd=fs.openSync(f,fs.existsSync(f)?'r+':'w');
      fs.ftruncateSync(fd,0);
      fs.writeFileSync(fd,payload,{encoding:'utf8'});
      fs.fsyncSync(fd);
      fs.closeSync(fd);fd=null;
      try{if(fs.existsSync(t))fs.unlinkSync(t)}catch{}
      return;
    }catch(fallbackError){
      if(fd!==null)try{fs.closeSync(fd)}catch{}
      last=fallbackError;
    }
  }
  try{if(fs.existsSync(t))fs.unlinkSync(t)}catch{}
  throw last;
}
const stable=v=>Array.isArray(v)?'['+v.map(stable).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}':JSON.stringify(v);
const digest=v=>crypto.createHash('sha256').update(typeof v==='string'?v:stable(v)).digest('hex');
function findingSignature(result={}){const xs=(result.blocking_findings??[]).map(x=>String(x).trim().toLowerCase()).filter(Boolean).sort();return digest({p0:Number(result.p0||0),p1:Number(result.p1||0),blocking:xs});}
function fail(code,detail=''){const e=new Error(detail?code+':'+detail:code);e.code=code;throw e;}
function loadMaster(){return read(MASTER,{schemaVersion:1,revision:0,works:[],updatedAt:null});}
function saveMaster(m,actor='AUDIT_WORK'){m.revision=Number(m.revision||0)+1;m.updatedAt=now();m.updatedBy=actor;atomic(MASTER,m);return m;}
function canonicalRepo(repo){const x=String(repo??'').trim();return x?x.includes('/')?x:'vmtct/'+x:null;}
function candidateVector(ledger){const rows=Array.isArray(ledger?.candidate?.repos)&&ledger.candidate.repos.length?ledger.candidate.repos:[ledger?.candidate];return rows.filter(Boolean).map(x=>({repo:canonicalRepo(x.repo),pr:Number(x.pr||0)||null,headSha:x.finalHeadSha??x.headSha??null,baseSha:x.baseSha??null}));}
function vectorHash(ledger){return digest(candidateVector(ledger));}
const RISK_FAMILY_MAP={actorFacing:'SURFACE_REACHABILITY',permissionSurface:'ACL_SCOPE_MATRIX',runtimeBindings:'RUNTIME_BINDINGS',externalProvider:'EXTERNAL_PROVIDER_BOUNDARY',crossRepoWire:'CROSS_REPO_WIRE',bootstrap:'EMPTY_STATE_BOOTSTRAP',productionJourneyRequired:'PRODUCTION_GJ_DECLARATION'};
function requiredRiskFamilies(ledger){
  const manifestPath=String(ledger?.dev?.testImpact?.manifestPath??'').trim();if(!manifestPath)return [];
  const manifest=read(manifestPath,null);if(!manifest||Number(manifest.schema_version??2)<3)return [];
  const risk=manifest.risk_contract??{};return [...new Set(Object.entries(RISK_FAMILY_MAP).filter(([key])=>risk[key]===true).map(([,family])=>family))].sort();
}
function ruleBReceipt(ledger){
  const r=ledger?.dev?.reviewCompleteness??ledger?.dev?.ruleBReceipt??null;
  if(!r)fail('AUDIT_WORK_PAP454_RECEIPT_REQUIRED');
  const out={
    reviewContext:String(r.reviewContext??'').trim().toUpperCase(),
    rootInvariant:String(r.rootInvariant??'').trim(),
    riskFamily:Array.isArray(r.riskFamily)?r.riskFamily.map(String).filter(Boolean).join(';'):String(r.riskFamily??'').trim(),
    adjacentSurfaces:Array.isArray(r.adjacentSurfaces)?r.adjacentSurfaces.map(String).filter(Boolean).join('; '):String(r.adjacentSurfaces??'').trim(),
    adjacentSweepResult:String(r.adjacentSweepResult??'').trim(),
    scopeReassess:String(r.scopeReassess??'').trim().toUpperCase(),
    priorBlockingReview:String(r.priorBlockingReview??'').trim(),
    priorBlockingFindings:Array.isArray(r.priorBlockingFindings)?r.priorBlockingFindings.map(String).filter(Boolean).join(' | '):String(r.priorBlockingFindings??'').trim(),
    promotedJiraKeys:Array.isArray(r.promotedJiraKeys)?r.promotedJiraKeys.map(String).filter(Boolean).join(','):String(r.promotedJiraKeys??'').trim(),
  };
  for(const k of ['reviewContext','rootInvariant','riskFamily','adjacentSurfaces','adjacentSweepResult','scopeReassess'])if(!out[k])fail('AUDIT_WORK_PAP454_RECEIPT_INCOMPLETE',k);
  if(!['INITIAL','POST_FINDING'].includes(out.reviewContext))fail('AUDIT_WORK_PAP454_REVIEW_CONTEXT_INVALID',out.reviewContext);
  if(!['NOT_REQUIRED','KEEP_BOUNDED','PROMOTE_CHILD','RECLASSIFY_HOST'].includes(out.scopeReassess))fail('AUDIT_WORK_PAP454_SCOPE_REASSESS_INVALID',out.scopeReassess);
  if(out.reviewContext==='POST_FINDING'&&(!out.priorBlockingReview||!out.priorBlockingFindings))fail('AUDIT_WORK_PAP454_PRIOR_FINDING_RECEIPT_REQUIRED');
  if(out.scopeReassess==='PROMOTE_CHILD'&&!out.promotedJiraKeys)fail('AUDIT_WORK_PAP454_PROMOTED_JIRA_KEYS_REQUIRED');
  if(!/^PASS\b/i.test(out.adjacentSweepResult))fail('AUDIT_WORK_PAP454_ADJACENT_SWEEP_NOT_PASS',out.adjacentSweepResult);
  return out;
}
function normalizeEvidencePath(ref){
  let x=String(ref??'').trim().replace(/\\/g,'/');
  const wsl=x.match(/^\/mnt\/([a-zA-Z])\/(.*)$/);if(wsl)x=wsl[1].toUpperCase()+':/'+wsl[2];
  if(!path.isAbsolute(x))x=path.join(ROOT,x.replace(/^\.\//,''));
  return x;
}
function validateCodexCapacityEvidence(ref,candidateHeadSha,reviewMode='INDIE',expectedRepository=null){
  const file=normalizeEvidencePath(ref);if(!file||!fs.existsSync(file))fail('AUDIT_WORK_CODEX_CAPACITY_EVIDENCE_MISSING',file);
  const receipt=read(file,null);if(!receipt)fail('AUDIT_WORK_CODEX_CAPACITY_EVIDENCE_INVALID',file);
  if(receipt.schemaVersion!==1||receipt.kind!=='PINO_CODEX_FALLBACK_ELIGIBILITY'||receipt.exitClass!=='CAPACITY_EXHAUSTED'||receipt.allAuthenticatedProfilesExhausted!==true||!Array.isArray(receipt.profilesAttempted)||receipt.profilesAttempted.length<1)fail('AUDIT_WORK_CODEX_CAPACITY_EVIDENCE_INVALID',file);
  if(receipt.candidate!==candidateHeadSha)fail('AUDIT_WORK_CODEX_CAPACITY_EVIDENCE_HEAD_MISMATCH');
  if(String(receipt.reviewKind??'').toUpperCase()!==String(reviewMode).toUpperCase())fail('AUDIT_WORK_CODEX_CAPACITY_EVIDENCE_MODE_MISMATCH');
  if(expectedRepository&&canonicalRepo(receipt.repository)!==canonicalRepo(expectedRepository))fail('AUDIT_WORK_CODEX_CAPACITY_EVIDENCE_REPOSITORY_MISMATCH');
  const at=Date.parse(receipt.createdAt??'');if(!Number.isFinite(at)||Date.now()-at<0||Date.now()-at>CODEX_FALLBACK_MAX_AGE_MS)fail('AUDIT_WORK_CODEX_CAPACITY_EVIDENCE_STALE');
  return {file,hash:digest(receipt),receipt};
}
function conversationId(url){return String(url??'').match(/\/c\/([0-9a-f-]{36})/i)?.[1]??null;}
function runJson(command,args,{timeout=300000,env={}}={}){const x=spawnSync(command,args,{encoding:'utf8',windowsHide:true,timeout,maxBuffer:16*1024*1024,env:{...process.env,...env}});if(x.status!==0){const e=new Error(String(x.stderr||x.stdout||x.error?.message||x.status).trim());e.exitCode=x.status;e.stdout=x.stdout;e.stderr=x.stderr;throw e;}const lines=String(x.stdout??'').trim().split(/\r?\n/);for(let i=0;i<lines.length;i++){try{return JSON.parse(lines.slice(i).join('\n'))}catch{}}fail('JSON_OUTPUT_PARSE_FAILED',x.stdout);}
function patchLedger(file,fn,actor='AUDIT_WORK'){const l=read(file);if(!l)fail('AUDIT_WORK_LEDGER_MISSING',file);const n=fn(structuredClone(l));n.revision=Number(l.revision||0)+1;n.updatedAt=now();n.updatedBy=actor;atomic(file,n);return n;}
function auditRecord(label){return read(ROOT+'/state/chatgpt-audit/'+label+'.json',null);}
function supersedeMatchingManualAudit(w,round,ledger){
  const ma=ledger?.manualAudit;if(!ma?.auditId||ma.status!=='PENDING_MANUAL_DISPATCH')return null;
  const currentHash=vectorHash(ledger);
  if(ma.candidateVectorHash&&ma.candidateVectorHash!==currentHash)return null;
  const m=read(MANUAL_AUDIT_MASTER,null);if(!m)return null;
  const a=(m.audits??[]).find(x=>x.auditId===ma.auditId);if(!a||a.status!=='PENDING_MANUAL_DISPATCH')return null;
  if(a.candidateVectorHash&&a.candidateVectorHash!==currentHash)return null;
  const at=now();a.status='SUPERSEDED_BY_AUTO_AUDIT';a.supersededAt=at;a.supersededByAuditWorkId=w.workId;a.supersededByRound=round.round;
  a.history=a.history??[];a.history.push({at,event:'SUPERSEDED_BY_AUTO_AUDIT',workId:w.workId,round:round.round});
  m.revision=Number(m.revision||0)+1;m.updatedAt=at;m.updatedBy='AUDIT_WORK_AUTO_PROMOTION';atomic(MANUAL_AUDIT_MASTER,m);
  return {auditId:a.auditId,at};
}
function notify(){try{const c=spawn(process.execPath,[NOTIFIER],{detached:true,stdio:'ignore',windowsHide:true});c.unref();}catch{}}

function buildReviewPrompt(work,round,ledger){
  const vec=candidateVector(ledger),hash=digest(vec),primary=vec.find(x=>x.headSha===ledger?.candidate?.headSha)??vec[0],riskFamilies=requiredRiskFamilies(ledger),ruleB=ruleBReceipt(ledger);
  if(!primary?.repo||!primary?.pr||!primary?.headSha)fail('AUDIT_WORK_PRIMARY_CANDIDATE_INCOMPLETE');
  if(work.reviewExperiment==='REVIEW_CHAIN_SHORT_V1')return `PINO CHATGPT REMEDIATION VERIFY EXPERIMENT
REVIEW_KIND: INDIE
REVIEW_EXPERIMENT: REVIEW_CHAIN_SHORT_V1
REVIEW_EXPERIMENT_KEY: ${work.reviewExperimentKey}
HOST_JIRA_KEY: ${work.hostJiraKey}
REVIEW_PURPOSE: POST_CODEX_REMEDIATION_VERIFY
REPOSITORY: ${primary.repo}
PR_NUMBER: ${primary.pr}
CANDIDATE: ${primary.headSha}
REJECTED_CANDIDATE: ${work.rejectedCandidateSha}
ORIGINAL_CODEX_CANDIDATE: ${work.originalCodexCandidate}
ORIGINAL_CODEX_AUTHORITY: ${work.originalCodexAuthorityPath}
ORIGINAL_CODEX_EVIDENCE_HASH: ${work.originalCodexEvidenceHash}
REMEDIATION_DIFF: ${work.remediationDiff}
PRIOR_BLOCKING_FINDINGS: ${work.priorBlockingFindings}
ROOT_INVARIANT: ${work.rootInvariant}
RISK_FAMILY: ${work.riskFamily}
REMEDIATED_SURFACES: ${work.remediatedSurfaces}
REGRESSION_CASES: ${work.regressionCases}
ADJACENT_REMEDIATION_SURFACES: ${work.adjacentRemediationSurfaces}
RESULT_TRANSPORT: AUDIT_CHAT_V1

Repository/PR/source is READ-ONLY. This is a bounded remediation verification under PAP-507, not a full fresh INDIE. Verify the original Codex findings and regressions directly created by or reachable from the remediation only. Do not rerun full-axis discovery or hunt unrelated historical defects.`;
  return `PINO CHATGPT INDIE FALLBACK AUDIT
REVIEW_KIND: INDIE
FALLBACK_REASON: ${work.fallbackReason}
CODEX_EVIDENCE_REF: ${work.codexEvidenceRef}
CODEX_ATTEMPTED_HEAD: ${work.codexAttemptedHeadSha??'NONE'}
CODEX_CAPACITY_EVIDENCE_REUSED: ${work.codexCapacityEvidenceReused===true}
REPOSITORY: ${primary.repo}
PR_NUMBER: ${primary.pr}
CANDIDATE: ${primary.headSha}
WORK_ID: ${work.workId}
PARENT_LEDGER: ${work.ledgerPath}
AUDIT_WORK_ROUND: ${round.round}
CANDIDATE_VECTOR_HASH: ${hash}
CANDIDATE_VECTOR: ${JSON.stringify(vec)}
RISK_SWEEP_FAMILIES: ${riskFamilies.length?riskFamilies.join(','):'NONE'}
FULL_AXIS_SWEEP: INDIE_FULL_AXIS_SWEEP_V1
FULL_AXIS_AXES: ${INDIE_FULL_AXIS_SWEEP_V1.join(',')}
REVIEW_CONTEXT: ${ruleB.reviewContext}
ROOT_INVARIANT: ${ruleB.rootInvariant}
RISK_FAMILY: ${ruleB.riskFamily}
ADJACENT_SURFACES: ${ruleB.adjacentSurfaces}
ADJACENT_SWEEP_RESULT: ${ruleB.adjacentSweepResult}
SCOPE_REASSESS: ${ruleB.scopeReassess}
${ruleB.priorBlockingReview?`PRIOR_BLOCKING_REVIEW: ${ruleB.priorBlockingReview}
`:''}${ruleB.priorBlockingFindings?`PRIOR_BLOCKING_FINDINGS: ${ruleB.priorBlockingFindings}
`:''}${ruleB.promotedJiraKeys?`PROMOTED_JIRA_KEYS: ${ruleB.promotedJiraKeys}
`:''}ADJACENT_IMPACT_SCOPE: PR diff plus material shared, newly reachable, semantically coupled and sibling paths across the full candidate vector.
NEGATIVE_CASES: stale candidate/vector, malformed authority, wrong tenant/role/state, replay/idempotence, boundary values, sibling-family regressions, scope escalation and fail-open behavior.

You are AUDIT_REVIEWER for this round. Repository/PR/source is READ-ONLY during review. Do not remediate in this phase.
Apply PAP-454 Rule B. Review ROOT_INVARIANT + RISK_FAMILY as the semantic target, not merely the literal patch. Independently challenge the declared ADJACENT_SURFACES/ADJACENT_SWEEP_RESULT across sibling verbs, entities and authority dimensions. Perform one bounded but complete INDIE review. INDIE_FULL_AXIS_SWEEP_V1 is mandatory: finish every listed FULL_AXIS_AXES dimension before terminal authority. A P0/P1 finding is not a stop condition; record it, continue all remaining axes, dedupe by root invariant/risk family, and batch all blocking findings before verdict.
If P0/P1 findings exist, return FINDINGS with all blocking findings and any scope-escalation signal. The reviewer is permanently read-only for this candidate and MUST NOT transition into a remediator or source mutator. The owner/RC will consume the finding, perform RCA-family remediation outside this Audit conversation, create a new immutable candidate, run exact-head CI and request one fresh independent INDIE.
If clean, return PASS. A zero-P HOLD is allowed only for a named non-code blocker.
`;
}
function makeWork(spec,ledger){
  const vec=candidateVector(ledger),hash=digest(vec);
  return {workId:spec.workId??ledger?.slice?.id,ledgerPath:spec.ledgerPath,title:spec.title??ledger?.slice?.title??ledger?.feature?.title??spec.workId,
    reviewMode:'INDIE',status:'READY_FOR_AUDIT',createdAt:now(),updatedAt:now(),currentRound:0,
    fallbackReason:spec.fallbackReason,codexEvidenceRef:spec.codexEvidenceRef,codexEvidenceHash:spec.codexEvidenceHash,codexAttemptedHeadSha:spec.codexAttemptedHeadSha,codexCapacityEvidenceReused:spec.codexCapacityEvidenceReused===true,
    reviewExperiment:spec.reviewExperiment??null,reviewExperimentKey:spec.reviewExperimentKey??null,hostJiraKey:spec.hostJiraKey??null,reviewPurpose:spec.reviewPurpose??null,
    originalCodexAuthorityPath:spec.originalCodexAuthorityPath??null,originalCodexEvidenceHash:spec.originalCodexEvidenceHash??null,originalCodexCandidate:spec.originalCodexCandidate??null,rejectedCandidateSha:spec.rejectedCandidateSha??null,
    remediationDiff:spec.remediationDiff??null,priorBlockingFindings:spec.priorBlockingFindings??null,rootInvariant:spec.rootInvariant??null,riskFamily:spec.riskFamily??null,remediatedSurfaces:spec.remediatedSurfaces??null,regressionCases:spec.regressionCases??null,adjacentRemediationSurfaces:spec.adjacentRemediationSurfaces??null,
    originalHandlerUrl:ledger?.mutationAdmission?.handler?.chatgptUrl??ledger?.dev?.handlerConversationUrl??null,
    candidateVector:vec,candidateVectorHash:hash,rounds:[],history:[{at:now(),event:'AUDIT_WORK_CREATED',candidateVectorHash:hash,fallbackReason:spec.fallbackReason,codexEvidenceRef:spec.codexEvidenceRef}]};
}
function persistWork(m,w,event,data={}){w.updatedAt=now();w.history=w.history??[];w.history.push({at:w.updatedAt,event,...data});saveMaster(m);return w;}
async function dispatchRound(m,w){
  const ledger=read(w.ledgerPath);if(!ledger)fail('AUDIT_WORK_LEDGER_MISSING');
  if(ledger?.ownership?.stream!=='DEV')fail('AUDIT_WORK_DEV_OWNERSHIP_REQUIRED',String(ledger?.ownership?.stream));
  const vec=candidateVector(ledger),hash=digest(vec),roundNo=(w.rounds?.length??0)+1;
  if(w.reviewExperiment==='REVIEW_CHAIN_SHORT_V1'&&(w.rounds?.length??0)>=1)fail('REVIEW_CHAIN_SHORT_CHATGPT_BUDGET_EXHAUSTED');
  if(w.rounds?.some(x=>x.candidateVectorHash===hash&&['REVIEWING','PASS_FINALIZING','FINDINGS','REMEDIATING'].includes(x.status)))fail('AUDIT_WORK_DUPLICATE_VECTOR_ROUND',hash);
  const round={round:roundNo,status:'DISPATCHING',candidateVector:vec,candidateVectorHash:hash,label:'aw-'+digest(w.workId).slice(0,10)+'-r'+roundNo+'-'+(ledger?.candidate?.headSha??'head').slice(0,8),
    dispatchedAt:null,conversationId:null,conversationUrl:null,reviewKey:null,promptPath:ROOT+'/state/audit-work/prompts/'+digest(w.workId).slice(0,16)+'-r'+roundNo+'.txt',
    result:null,resultEvidenceHash:null,notification:{success:'PENDING',failure:null}};
  fs.mkdirSync(path.dirname(round.promptPath),{recursive:true});const prompt=buildReviewPrompt(w,round,ledger);fs.writeFileSync(round.promptPath,prompt+'\n');
  w.rounds.push(round);w.currentRound=roundNo;w.status='DISPATCHING';persistWork(m,w,'AUDIT_ROUND_DISPATCHING',{round:roundNo,candidateVectorHash:hash});
  try{
    const auditArgs=[AUDIT_TOOL,'start',round.promptPath,round.label];
    const requesterUrl=w.originalHandlerUrl??null,requesterId=conversationId(requesterUrl);
    if(requesterUrl&&requesterId)auditArgs.push(requesterId,requesterUrl);
    runJson(process.execPath,auditArgs,{timeout:360000});
    const ar=auditRecord(round.label);if(!ar?.conversationId||!ar?.url||ar.state!=='CONFIRMED')fail('AUDIT_WORK_DISPATCH_NOT_CONFIRMED');
    round.status='REVIEWING';round.dispatchedAt=now();round.conversationId=ar.conversationId;round.conversationUrl=ar.url;round.reviewKey=ar.reviewKey;
    round.bootstrapYielded=ar.bootstrapYielded===true;round.bootstrapYieldedAt=ar.bootstrapYieldedAt??null;round.originalHandlerUrl=w.originalHandlerUrl??ar.requesterConversationUrl??null;
    round.notification.success='PENDING';
    const supersededManual=supersedeMatchingManualAudit(w,round,ledger);round.supersededManualAuditId=supersededManual?.auditId??null;
    releaseActiveMutationLease(w,'AUDIT_REVIEW_DISPATCH_CONFIRMED_ROUND_'+roundNo);
    patchLedger(w.ledgerPath,l=>{l.auditWork={workId:w.workId,status:'REVIEWING',currentRound:roundNo,candidateVectorHash:hash,handlerConversationUrl:round.conversationUrl,handlerConversationId:round.conversationId,updatedAt:now()};if(supersededManual&&l.manualAudit?.auditId===supersededManual.auditId)l.manualAudit={...l.manualAudit,status:'SUPERSEDED_BY_AUTO_AUDIT',supersededAt:supersededManual.at,supersededByAuditWorkId:w.workId,supersededByRound:roundNo};l.dev=l.dev??{};l.dev.phase='REVIEW';l.dev.nextAction='WAIT_CHATGPT_FALLBACK_INDIE_RESULT';return l;},'AUDIT_WORK_DISPATCH_CONFIRMED');
    w.status='REVIEWING';w.candidateVector=vec;w.candidateVectorHash=hash;persistWork(m,w,'AUDIT_ROUND_DISPATCH_CONFIRMED',{round:roundNo,conversationUrl:round.conversationUrl});
    notify();return {ok:true,workId:w.workId,round:roundNo,status:w.status,conversationUrl:round.conversationUrl,label:round.label};
  }catch(error){
    const ar=auditRecord(round.label);
    if(ar?.conversationId)round.conversationId=ar.conversationId;
    if(ar?.url)round.conversationUrl=ar.url;
    round.bootstrapYielded=ar?.bootstrapYielded===true;
    round.bootstrapState=ar?.state??null;
    round.status=['OUTCOME_UNKNOWN','DISPATCH_OUTCOME_UNKNOWN','BOOTSTRAP_OUTCOME_UNKNOWN'].includes(ar?.state)?'DISPATCH_UNCERTAIN':'DISPATCH_FAILED';round.dispatchError=String(error?.message??error);round.notification.failure='PENDING';w.status=round.status;
    persistWork(m,w,'AUDIT_ROUND_DISPATCH_FAILED',{round:roundNo,status:round.status,error:round.dispatchError});notify();
    return {ok:false,workId:w.workId,round:roundNo,status:w.status,error:round.dispatchError,promptPath:round.promptPath};
  }
}

function writeTempSpec(name,value){const p=ROOT+'/state/audit-work/tmp/'+name+'-'+process.pid+'-'+Date.now()+'.json';atomic(p,value);return p;}
function releaseActiveMutationLease(w,reason){
  const ledger=read(w.ledgerPath);if(!ledger)fail('AUDIT_WORK_LEDGER_MISSING');
  const active=ledger?.mutationAdmission?.status==='ACTIVE'?ledger.mutationAdmission:null;
  if(!active)return {already:true};
  if(active?.handler?.stream!=='DEV'||!active?.handler?.chatgptUrl)fail('AUDIT_WORK_ACTIVE_LEASE_INVALID');
  const p=writeTempSpec('release',{ledgerPath:w.ledgerPath,stream:'DEV',chatgptUrl:active.handler.chatgptUrl,reason});
  try{return runJson(process.execPath,[DEV_WORK,'release',p],{timeout:30000});}finally{try{fs.unlinkSync(p)}catch{}}
}
function projectReviewToLedger(w,round,result){
  const hasBlocking=Number(result.p0||0)>0||Number(result.p1||0)>0||(result.blocking_findings??[]).length>0;
  const cleanPass=result.verdict==='PASS'&&!hasBlocking;
  const status=cleanPass?'REVIEW_PASS':hasBlocking?'REMEDIATION_REQUIRED':'HOLD';
  return patchLedger(w.ledgerPath,l=>{
    if(digest(candidateVector(l))!==round.candidateVectorHash)fail('AUDIT_WORK_VECTOR_DRIFT_BEFORE_PROJECTION');
    l.auditWork={workId:w.workId,status,currentRound:round.round,candidateVectorHash:round.candidateVectorHash,reviewerConversationUrl:round.conversationUrl,reviewerConversationId:round.conversationId,updatedAt:now()};
    l.dev=l.dev??{};
    l.dev.review={mode:'INDIE',round:round.round,result:result.verdict,reviewedHeadSha:l.candidate?.headSha,independent:true,source:w.reviewExperiment==='REVIEW_CHAIN_SHORT_V1'?'CHATGPT_AUDIT_AUTO':'CHATGPT_AUDIT_FALLBACK',
      fallbackReason:w.fallbackReason,codexEvidenceRef:w.codexEvidenceRef,codexEvidenceHash:w.codexEvidenceHash,codexAttemptedHeadSha:w.codexAttemptedHeadSha,codexCapacityEvidenceReused:w.codexCapacityEvidenceReused===true,
      reviewExperiment:w.reviewExperiment??null,reviewExperimentKey:w.reviewExperimentKey??null,hostJiraKey:w.hostJiraKey??null,reviewPurpose:w.reviewPurpose??null,originalCodexAuthorityPath:w.originalCodexAuthorityPath??null,originalCodexEvidenceHash:w.originalCodexEvidenceHash??null,
      evidenceHash:round.resultEvidenceHash,reviewerConversationId:round.conversationId,reviewerConversationUrl:round.conversationUrl,
      auditWorkId:w.workId,auditWorkRound:round.round,auditWorkCandidateVectorHash:round.candidateVectorHash,
      p0:result.p0,p1:result.p1,blockingFindings:result.blocking_findings,summary:result.summary,
      riskFamiliesSwept:result.risk_families_swept??[],unsweptRiskFamilies:result.unswept_risk_families??[]};
    if(cleanPass){l.dev.phase='FINAL_SELF_TEST';l.dev.nextAction='OWNER_FINAL_SELF_TEST_AND_HANDOFF';}
    else if(hasBlocking){
      l.dev.phase='REMEDIATE';l.dev.nextAction=w.reviewExperiment==='REVIEW_CHAIN_SHORT_V1'?'REVIEW_CHAIN_SHORT_FINAL_OWNER_REMEDIATION_SELF_AUDIT':'PAP454_RCA_FAMILY_REMEDIATION_THEN_FRESH_INDIE';
      l.dev.remediation={...(l.dev.remediation??{}),status:'REQUIRED',sourceRound:round.round,findings:result.blocking_findings,reviewedHeadSha:l.candidate?.headSha,ruleB:'PAP-454'};
      l.dev.reviewCompleteness={reviewContext:'POST_FINDING',priorBlockingReview:`round=${round.round};candidate=${l.candidate?.headSha??''};evidence=${round.resultEvidenceHash??''}`,priorBlockingFindings:result.blocking_findings,status:'REQUIRED',ruleB:'PAP-454'};
    }else{
      l.dev.phase='REVIEW';l.dev.nextAction='AUDIT_HOLD_BLOCKER';l.dev.reviewHold={status:'HOLD',summary:result.summary??'',at:now(),round:round.round};
    }
    return l;
  },'AUDIT_WORK_REVIEW_RESULT');
}
async function recoverDispatchRound(m,w,round){
  if(!round||!['DISPATCHING','DISPATCH_UNCERTAIN','DISPATCH_FAILED'].includes(round.status))return {ok:false,workId:w.workId,status:w.status,reason:'AUDIT_WORK_DISPATCH_RECOVERY_NOT_ELIGIBLE'};
  const ledger=read(w.ledgerPath);if(!ledger)fail('AUDIT_WORK_LEDGER_MISSING');
  if(vectorHash(ledger)!==round.candidateVectorHash){round.status='STALE_CANDIDATE';w.status='STALE_CANDIDATE';persistWork(m,w,'AUDIT_WORK_DISPATCH_RECOVERY_STALE',{round:round.round});return {ok:false,workId:w.workId,status:w.status};}
  try{
    const auditArgs=[AUDIT_TOOL,'start',round.promptPath,round.label];
    const requesterUrl=w.originalHandlerUrl??null,requesterId=conversationId(requesterUrl);
    if(requesterUrl&&requesterId)auditArgs.push(requesterId,requesterUrl);
    runJson(process.execPath,auditArgs,{timeout:360000});
    const ar=auditRecord(round.label);if(!ar?.conversationId||!ar?.url||ar.state!=='CONFIRMED')fail('AUDIT_WORK_DISPATCH_RECOVERY_NOT_CONFIRMED');
    round.status='REVIEWING';round.dispatchedAt=round.dispatchedAt??now();round.conversationId=ar.conversationId;round.conversationUrl=ar.url;round.reviewKey=ar.reviewKey;
    round.bootstrapYielded=ar.bootstrapYielded===true;round.bootstrapYieldedAt=ar.bootstrapYieldedAt??null;round.originalHandlerUrl=w.originalHandlerUrl??ar.requesterConversationUrl??null;
    round.dispatchRecoveredAt=now();round.dispatchRecoveryLabel=round.label;round.notification=round.notification??{};round.notification.success='PENDING';round.notification.failure=null;
    const supersededManual=supersedeMatchingManualAudit(w,round,ledger);round.supersededManualAuditId=supersededManual?.auditId??round.supersededManualAuditId??null;
    releaseActiveMutationLease(w,'AUDIT_REVIEW_DISPATCH_RECOVERED_ROUND_'+round.round);
    patchLedger(w.ledgerPath,l=>{l.auditWork={workId:w.workId,status:'REVIEWING',currentRound:round.round,candidateVectorHash:round.candidateVectorHash,handlerConversationUrl:round.conversationUrl,handlerConversationId:round.conversationId,updatedAt:now()};if(supersededManual&&l.manualAudit?.auditId===supersededManual.auditId)l.manualAudit={...l.manualAudit,status:'SUPERSEDED_BY_AUTO_AUDIT',supersededAt:supersededManual.at,supersededByAuditWorkId:w.workId,supersededByRound:round.round};l.dev=l.dev??{};l.dev.phase='REVIEW';l.dev.nextAction='WAIT_CHATGPT_FALLBACK_INDIE_RESULT';return l;},'AUDIT_WORK_DISPATCH_RECOVERED');
    w.status='REVIEWING';w.candidateVector=round.candidateVector;w.candidateVectorHash=round.candidateVectorHash;persistWork(m,w,'AUDIT_ROUND_DISPATCH_RECOVERED',{round:round.round,conversationUrl:round.conversationUrl});notify();
    return {ok:true,recovered:true,workId:w.workId,round:round.round,status:w.status,conversationUrl:round.conversationUrl,label:round.label};
  }catch(error){round.lastDispatchRecoveryAt=now();round.lastDispatchRecoveryError=String(error?.message??error);saveMaster(m);return {ok:false,recovered:false,workId:w.workId,round:round.round,status:w.status,error:round.lastDispatchRecoveryError};}
}
async function reconcileWork(m,w){
  const round=w.rounds?.find(x=>x.round===w.currentRound);if(!round)return {ok:false,status:'NO_CURRENT_ROUND'};
  if(round.status==='REMEDIATING')fail('AUDIT_WORK_IN_AUDIT_REMEDIATION_RETIRED_PAP454');
  if(['PASS_FINALIZING','REMEDIATED_FINALIZING'].includes(round.status))fail('AUDIT_WORK_AUDIT_CONVERSATION_HANDOFF_RETIRED_PAP454');
  if(['DISPATCHING','DISPATCH_UNCERTAIN','DISPATCH_FAILED'].includes(round.status))return await recoverDispatchRound(m,w,round);
  if(round.status!=='REVIEWING')return {ok:true,workId:w.workId,status:w.status,roundStatus:round.status};
  const ledger=read(w.ledgerPath);if(!ledger)fail('AUDIT_WORK_LEDGER_MISSING');
  if(vectorHash(ledger)!==round.candidateVectorHash){round.status='STALE_CANDIDATE';w.status='STALE_CANDIDATE';persistWork(m,w,'AUDIT_WORK_REVIEW_STALE',{round:round.round});return {ok:false,workId:w.workId,status:w.status};}
  let status;
  try{status=runJson(process.execPath,[AUDIT_TOOL,'status',round.label],{timeout:180000});}
  catch(error){
    round.lastPollError=String(error?.message??error);round.lastPollAt=now();saveMaster(m);
    try{
      const refreshed=runJson(process.execPath,[AUDIT_TOOL,'recover-refresh',round.label],{timeout:180000});
      round.lastRecoveryAt=now();round.lastRecovery='REFRESH_EXACT_CONVERSATION';round.lastRecoveryResult=refreshed;
      status=runJson(process.execPath,[AUDIT_TOOL,'status',round.label],{timeout:180000});
    }catch(recoveryError){
      round.lastRecoveryError=String(recoveryError?.message??recoveryError);saveMaster(m);
      return {ok:false,workId:w.workId,status:'POLL_ERROR',error:round.lastPollError,recoveryError:round.lastRecoveryError};
    }
  }
  round.lastPollAt=now();
  if(status.terminal!==true||!status.auditResult){saveMaster(m);return {ok:true,workId:w.workId,status:'REVIEWING',busy:status.busy===true};}
  const ready=runJson(process.execPath,[AUDIT_TOOL,'result',round.label],{timeout:60000});
  const result=status.auditResult;round.result=result;round.resultEvidenceHash=ready.evidenceHash??null;round.terminalAt=now();
  const hasP=Number(result.p0||0)>0||Number(result.p1||0)>0||(result.blocking_findings??[]).length>0;
  if(result.verdict==='PASS'&&!hasP){
    round.status='PASS';w.status='REVIEW_PASS';projectReviewToLedger(w,round,result);persistWork(m,w,'AUDIT_ROUND_PASS',{round:round.round,verdict:result.verdict});
    try{runJson(process.execPath,[AUDIT_TOOL,'consume',round.label],{timeout:120000});round.consumedAt=now();}catch(error){round.consumeWarning=String(error?.message??error);}saveMaster(m);
    return {ok:true,workId:w.workId,status:w.status,round:round.round,conversationUrl:round.conversationUrl};
  }
  if((result.verdict==='FINDINGS'||result.verdict==='HOLD')&&hasP){
    round.findingSignature=findingSignature(result);
    round.status='FINDINGS';w.status='REMEDIATION_REQUIRED';projectReviewToLedger(w,round,result);persistWork(m,w,'AUDIT_ROUND_FINDINGS',{round:round.round,p0:result.p0,p1:result.p1,findingSignature:round.findingSignature,ruleB:'PAP-454'});
    try{runJson(process.execPath,[AUDIT_TOOL,'consume',round.label],{timeout:120000});round.consumedAt=now();}catch(error){round.consumeWarning=String(error?.message??error);}saveMaster(m);
    return {ok:true,workId:w.workId,status:w.status,round:round.round,conversationUrl:round.conversationUrl,nextAction:w.reviewExperiment==='REVIEW_CHAIN_SHORT_V1'?'REVIEW_CHAIN_SHORT_FINAL_OWNER_REMEDIATION_SELF_AUDIT':'PAP454_RCA_FAMILY_REMEDIATION_THEN_FRESH_INDIE'};
  }
  round.status='HOLD';w.status='HOLD';projectReviewToLedger(w,round,result);persistWork(m,w,'AUDIT_ROUND_HOLD',{round:round.round,verdict:result.verdict});
  try{runJson(process.execPath,[AUDIT_TOOL,'consume',round.label],{timeout:120000});round.consumedAt=now();}catch(error){round.consumeWarning=String(error?.message??error);}saveMaster(m);
  return {ok:true,workId:w.workId,status:w.status};
}

async function startWork(spec){
  if(!spec?.ledgerPath)fail('AUDIT_WORK_LEDGER_PATH_REQUIRED');
  const ledger=read(spec.ledgerPath);if(!ledger)fail('AUDIT_WORK_LEDGER_MISSING');
  if(ledger?.ownership?.stream!=='DEV')fail('AUDIT_WORK_DEV_OWNERSHIP_REQUIRED');
  const workId=spec.workId??ledger?.slice?.id;if(!workId)fail('AUDIT_WORK_ID_REQUIRED');
  const m=loadMaster();let w=m.works.find(x=>x.workId===workId);
  if(!w){
    const candidateHead=String(ledger?.candidate?.headSha??'');
    if(spec.reviewExperiment==='REVIEW_CHAIN_SHORT_V1'){
      validateReviewChainShortActivation({key:spec.reviewExperimentKey,host:spec.hostJiraKey});
      if(spec.reviewPurpose!=='POST_CODEX_REMEDIATION_VERIFY')fail('REVIEW_CHAIN_SHORT_PURPOSE_INVALID');
      const rejected=String(spec.rejectedCandidateSha??''),original=String(spec.originalCodexCandidate??'');
      if(!/^[0-9a-f]{40}$/i.test(rejected)||!original||candidateHead===rejected)fail('REVIEW_CHAIN_SHORT_REMEDIATION_HEAD_INVALID');
      const authority=validateOriginalCodexAuthority({authorityPath:spec.originalCodexAuthorityPath,authorityHash:spec.originalCodexEvidenceHash,originalCandidate:original,repository:canonicalRepo(ledger?.candidate?.repo),prNumber:Number(ledger?.candidate?.pr)});
      for(const key of ['remediationDiff','priorBlockingFindings','rootInvariant','riskFamily','remediatedSurfaces','regressionCases','adjacentRemediationSurfaces'])if(!String(spec[key]??'').trim())fail('REVIEW_CHAIN_SHORT_SPEC_INCOMPLETE',key);
      if(!Array.isArray(authority.blockingFindings)||authority.blockingFindings.length<1)fail('REVIEW_CHAIN_SHORT_CODEX_FINDINGS_REQUIRED');
      spec={...spec,fallbackReason:'POST_CODEX_REMEDIATION_VERIFY',codexEvidenceRef:null,codexEvidenceHash:null,codexAttemptedHeadSha:null,codexCapacityEvidenceReused:false};
    }else{
      const attempted=String(spec.codexAttemptedHeadSha??'').trim(),evidence=String(spec.codexEvidenceRef??'').trim();
      if(spec.fallbackReason!=='CAPACITY_EXHAUSTED'||!evidence)fail('AUDIT_WORK_CODEX_CAPACITY_EVIDENCE_REQUIRED');
      const quota=validateCodexCapacityEvidence(evidence,candidateHead,'INDIE',canonicalRepo(ledger?.candidate?.repo)),reused=quota.receipt?.capacityEvidenceReused===true&&quota.receipt?.codexAttemptedForCandidate===false;
      if(reused){if(attempted)fail('AUDIT_WORK_REUSED_CAPACITY_MUST_NOT_CLAIM_CODEX_ATTEMPT');}else if(attempted!==candidateHead)fail('AUDIT_WORK_CODEX_ATTEMPTED_HEAD_MISMATCH');
      spec={...spec,codexAttemptedHeadSha:reused?null:candidateHead,codexCapacityEvidenceReused:reused,codexEvidenceRef:quota.file,codexEvidenceHash:quota.hash};
    }
  }
  if(w){
    if(path.resolve(w.ledgerPath)!==path.resolve(spec.ledgerPath))fail('AUDIT_WORK_ID_CONFLICT');
    if(w.reviewExperiment==='REVIEW_CHAIN_SHORT_V1'&&w.status==='REMEDIATION_REQUIRED')fail('REVIEW_CHAIN_SHORT_REVIEW_BUDGET_EXHAUSTED');
    if(['REVIEWING','REVIEW_PASS','DEV_HANDOFF_READY'].includes(w.status))return {ok:true,idempotent:true,workId,status:w.status,currentRound:w.currentRound};
    if(['REMEDIATING','PASS_FINALIZING','REMEDIATED_FINALIZING'].includes(w.status))fail('AUDIT_WORK_LEGACY_STATE_RETIRED_PAP454',w.status);
    if(['DISPATCHING','DISPATCH_UNCERTAIN','DISPATCH_FAILED'].includes(w.status))return await recoverDispatchRound(m,w,w.rounds?.find(x=>x.round===w.currentRound)??w.rounds?.at(-1));
    if(w.status==='REMEDIATION_REQUIRED'){
      const currentHash=vectorHash(ledger),prior=w.rounds?.at(-1);
      if(!prior||currentHash===prior.candidateVectorHash)fail('AUDIT_WORK_PAP454_REMEDIATION_HEAD_UNCHANGED');
      const candidateHead=String(ledger?.candidate?.headSha??''),attempted=String(spec.codexAttemptedHeadSha??'').trim(),evidence=String(spec.codexEvidenceRef??'').trim();
      if(spec.fallbackReason!=='CAPACITY_EXHAUSTED'||!evidence)fail('AUDIT_WORK_CODEX_CAPACITY_EVIDENCE_REQUIRED');
      const quota=validateCodexCapacityEvidence(evidence,candidateHead,'INDIE',canonicalRepo(ledger?.candidate?.repo)),reused=quota.receipt?.capacityEvidenceReused===true&&quota.receipt?.codexAttemptedForCandidate===false;
      if(reused){if(attempted)fail('AUDIT_WORK_REUSED_CAPACITY_MUST_NOT_CLAIM_CODEX_ATTEMPT');}else if(attempted!==candidateHead)fail('AUDIT_WORK_CODEX_ATTEMPTED_HEAD_MISMATCH');
      const ruleB=ruleBReceipt(ledger);if(ruleB.reviewContext!=='POST_FINDING')fail('AUDIT_WORK_PAP454_POST_FINDING_CONTEXT_REQUIRED');
      w.fallbackReason=spec.fallbackReason;w.codexEvidenceRef=quota.file;w.codexEvidenceHash=quota.hash;w.codexAttemptedHeadSha=reused?null:candidateHead;w.codexCapacityEvidenceReused=reused;w.status='READY_FOR_AUDIT';
      persistWork(m,w,'AUDIT_WORK_PAP454_FRESH_CANDIDATE_READY',{candidateVectorHash:currentHash});
    }
  }else{
    w=makeWork({...spec,workId},ledger);m.works.push(w);saveMaster(m,'AUDIT_WORK_START');
    patchLedger(spec.ledgerPath,l=>{l.auditWork={workId,status:'READY_FOR_AUDIT',currentRound:0,candidateVectorHash:vectorHash(l),updatedAt:now()};l.dev=l.dev??{};l.dev.phase='REVIEW';l.dev.nextAction='CHATGPT_FALLBACK_INDIE_AUDIT';return l;},'AUDIT_WORK_START');
  }
  return await dispatchRound(m,w);
}
async function reconcileAll(){
  const m=loadMaster(),results=[];
  for(const w of m.works.filter(x=>x.status==='REVIEWING')){
    try{results.push(await reconcileWork(m,w));}
    catch(error){w.lastControllerError=String(error?.message??error);w.lastControllerErrorAt=now();saveMaster(m,'AUDIT_WORK_RECONCILE_ERROR');results.push({ok:false,workId:w.workId,error:w.lastControllerError});}
  }
  return {ok:true,checked:results.length,results};
}
function statusWork(id){const w=loadMaster().works.find(x=>x.workId===id);if(!w)fail('AUDIT_WORK_NOT_FOUND');return {ok:true,work:w};}
const [cmd,arg1,arg2]=process.argv.slice(2);
try{
  let out;
  if(cmd==='start'){const spec=read(path.resolve(arg1));if(!spec)fail('AUDIT_WORK_SPEC_INVALID');out=await startWork(spec);}
  else if(cmd==='reconcile'){const m=loadMaster(),w=m.works.find(x=>x.workId===arg1);if(!w)fail('AUDIT_WORK_NOT_FOUND');out=await reconcileWork(m,w);}
  else if(cmd==='reconcile-all')out=await reconcileAll();
  else if(['remediation-complete','resume-remediation','finalize-remediation','handoff-complete','repair-projection'].includes(cmd))fail('AUDIT_WORK_IN_AUDIT_POST_REVIEW_MUTATION_RETIRED_PAP454');
  else if(cmd==='status')out=statusWork(arg1);
  else fail('USAGE','audit-work.mjs start <spec.json>|reconcile <workId>|reconcile-all|status <workId>');
  console.log(JSON.stringify(out,null,2));
}catch(error){console.error(JSON.stringify({ok:false,error:String(error?.message??error),code:error?.code??null,stack:error?.stack??null},null,2));process.exit(1);}
