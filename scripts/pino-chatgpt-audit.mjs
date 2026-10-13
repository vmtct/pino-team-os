import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync,spawn} from 'node:child_process';
import {syncAuditLabel} from './audit-run-registry.mjs';
import {parseReviewChainShortPrompt,validateReviewChainShortResult,reviewChainShortContract} from './review-chain-short-policy.mjs';
import {DEFAULT_MAX_SAFE_START_RETRIES,isSafeNoWriteStartResult,isSafeNoWriteStartRecord,safeStartRetryCount,canSafeRetryStart,retryIdempotencyKey} from './audit-start-retry-policy.mjs';

const GATEWAY='http://127.0.0.1:9461';
const PROJECT_ID='g-p-6aa207a6f9688191a2ba5bcccebca4d7';
const STATE_DIR='C:/Users/ADMIN/Documents/PINO_SOP/state/chatgpt-audit';
const RESULT_DIR=path.join(STATE_DIR,'results');
const PROMPT_DIR=path.join(STATE_DIR,'prompts');
const ENQUEUE_DIR=path.join(STATE_DIR,'enqueue');
const PINOCTL='D:/pino-ai-ops/control-plane/pac/src/pinoctl.mjs';
const QUEUE_DISABLE_FLAG='D:/pino-cache/controller/pac/audit-queue.disabled';
const CODEX_FALLBACK_DIR='C:/Users/ADMIN/Documents/PINO_SOP/state/codex-fallback';
const REVIEW_AUTHORITY_DIR='C:/Users/ADMIN/Documents/PINO_SOP/state/review-authority';
const REVIEW_EVIDENCE_DIR='C:/Users/ADMIN/Documents/PINO_SOP/state/review-evidence';
const REVIEW_AUTHORITY_LOCK_DIR=path.join(REVIEW_AUTHORITY_DIR,'.locks');
const WSL_EXE='C:/Windows/System32/wsl.exe';
const REVIEW_SOURCE_VERIFIER_WSL=process.env.PINO_REVIEW_SOURCE_VERIFIER_WSL||'/mnt/c/Users/ADMIN/Documents/PINO_SOP/tools/review-source-verifier.py';
const REVIEW_OBLIGATION_HELPER_WSL=process.env.PINO_REVIEW_OBLIGATION_HELPER_WSL||'/mnt/c/Users/ADMIN/Documents/PINO_SOP/tools/review-obligation-fence.py';
const REVIEW_REUSE_HELPER=process.env.PINO_REVIEW_REUSE_HELPER||'C:/Users/ADMIN/Documents/PINO_SOP/tools/review-authority-reuse.mjs';
const CODEX_FALLBACK_MAX_AGE_MS=60*60*1000;
const GH='C:/Program Files/GitHub CLI/gh.exe';
const TOKEN=fs.readFileSync('D:/pino-cache/controller/pac/gateway.token','utf8').trim();
const INDIE_FULL_AXIS_SWEEP_V1=["DOMAIN_STATE_LIFECYCLE","AUTHORITY_SECURITY","PERSISTENCE_MIGRATION","CONCURRENCY_ATOMICITY","REPLAY_IDEMPOTENCY","RECOVERY_ROLLBACK_CLEANUP","CROSS_BOUNDARY_INTEGRATION","CI_RELEASE_PRODUCTION_CONTROL","ADJACENT_SIBLING_PATHS","COMPATIBILITY_HISTORICAL_STATE"];
const INDIE_FULL_AXIS_VALUES=new Set(['PASS','NOT_APPLICABLE','FINDING']);
const indieFullAxisResultFields=()=>',"axis_results":'+JSON.stringify(Object.fromEntries(INDIE_FULL_AXIS_SWEEP_V1.map(axis=>[axis,{status:'PASS|NOT_APPLICABLE|FINDING',evidence:'<bounded evidence/rationale>'}])))+',"remaining_axes":[]';
const indieFullAxisInstruction=()=>` INDIE_FULL_AXIS_SWEEP_V1 is mandatory. Complete all ten axes before terminal authority: ${INDIE_FULL_AXIS_SWEEP_V1.join(', ')}. A P0/P1 finding is evidence to record, not a stop condition: continue the remaining axes and batch all blocking findings. Deduplicate findings by root invariant/risk family where they describe the same defect family. Every axis_result must be PASS, NOT_APPLICABLE, or FINDING with non-empty evidence/rationale, and remaining_axes must be []. PASS is invalid if any axis_result is FINDING.`;
function validateIndieFullAxisCoverage(result,enabled){
  if(!enabled)return result;
  const rows=result?.axis_results;if(!rows||typeof rows!=='object'||Array.isArray(rows))throw new Error('AUDIT_INDIE_AXIS_RESULTS_INVALID');
  const keys=Object.keys(rows),missing=INDIE_FULL_AXIS_SWEEP_V1.filter(x=>!Object.prototype.hasOwnProperty.call(rows,x)),extra=keys.filter(x=>!INDIE_FULL_AXIS_SWEEP_V1.includes(x));
  if(missing.length||extra.length)throw new Error('AUDIT_INDIE_AXIS_SET_MISMATCH:missing='+missing.join(',')+':extra='+extra.join(','));
  const findingAxes=[];for(const axis of INDIE_FULL_AXIS_SWEEP_V1){const row=rows[axis];if(!row||typeof row!=='object'||Array.isArray(row))throw new Error('AUDIT_INDIE_AXIS_ROW_INVALID:'+axis);const status=String(row.status??'').toUpperCase();if(!INDIE_FULL_AXIS_VALUES.has(status))throw new Error('AUDIT_INDIE_AXIS_STATUS_INVALID:'+axis);if(typeof row.evidence!=='string'||!row.evidence.trim())throw new Error('AUDIT_INDIE_AXIS_EVIDENCE_REQUIRED:'+axis);if(status==='FINDING')findingAxes.push(axis);}
  const remaining=result?.remaining_axes;if(!Array.isArray(remaining)||remaining.some(x=>typeof x!=='string'||!x.trim()))throw new Error('AUDIT_INDIE_REMAINING_AXES_INVALID');
  if(remaining.length)throw new Error('AUDIT_INDIE_FULL_AXIS_INCOMPLETE:'+remaining.join(','));
  const hasBlocking=Number(result?.p0||0)>0||Number(result?.p1||0)>0||(result?.blocking_findings??[]).length>0;
  if(result?.verdict==='PASS'&&findingAxes.length)throw new Error('AUDIT_INDIE_PASS_WITH_FINDING_AXIS');
  if(hasBlocking&&!findingAxes.length)throw new Error('AUDIT_INDIE_BLOCKING_WITHOUT_FINDING_AXIS');
  return result;
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const canonical=s=>String(s??'').replace(/\r\n/g,'\n').replace(/\r/g,'\n').trim();
const identity=s=>canonical(s).replace(/\u00a0/g,' ').replace(/[\u200b-\u200d\ufeff]/gi,'').split('\n').map(x=>x.replace(/[ \t]+$/,'')).join('\n').replace(/\n{2,}/g,'\n');
const sha=s=>crypto.createHash('sha256').update(identity(s)).digest('hex');
const stable=value=>Array.isArray(value)?'['+value.map(stable).join(',')+']':value&&typeof value==='object'?'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}':JSON.stringify(value);
const b64Json=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const winToWsl=p=>String(p).replace(/^([A-Za-z]):[\\/]/,(_,d)=>`/mnt/${d.toLowerCase()}/`).replaceAll('\\','/');
function materializePromptArtifact(prompt,promptSha256){fs.mkdirSync(PROMPT_DIR,{recursive:true});const target=path.join(PROMPT_DIR,promptSha256+'.txt');try{fs.writeFileSync(target,prompt,{flag:'wx'});}catch(error){if(error?.code!=='EEXIST')throw error;const existing=fs.readFileSync(target,'utf8');if(sha(existing)!==promptSha256)throw new Error('AUDIT_PROMPT_ARTIFACT_HASH_COLLISION');}return {windows:target,wsl:winToWsl(target)}}
function runWslPython(script,args){const x=spawnSync(WSL_EXE,['-d','Ubuntu-24.04','--','python3',script,...args],{encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024});if(x.status!==0)throw new Error('REVIEW_WSL_HELPER_FAILED:'+(x.stderr||x.stdout||x.error?.message||x.status));try{return JSON.parse((x.stdout||'').trim())}catch(e){throw new Error('REVIEW_WSL_HELPER_OUTPUT_INVALID:'+e.message)}}
function verifyChatgptSource(record,result,{actionId,receiptId,evidenceHash,expectedHash=null}={}){const args=['chatgpt','--action-id',String(actionId??''),'--receipt-id',String(receiptId??''),'--evidence-hash',String(evidenceHash??''),'--candidate',record.candidate,'--conversation-id',record.conversationId,'--prompt-sha',record.promptSha256,'--review-key',record.reviewKey,'--result-b64',b64Json(result),'--prompt-file',String(record.promptArtifactWsl??''),'--risk-hash',String(record.riskContractHash??''),'--risk-families-json',JSON.stringify(record.requiredRiskFamilies??[])];if(expectedHash)args.push('--expected-hash',expectedHash);return runWslPython(REVIEW_SOURCE_VERIFIER_WSL,args)}
function verifyResultArtifact(artifact){const {evidenceHash,...core}=artifact??{};const actual=crypto.createHash('sha256').update(stable(core)).digest('hex');if(!evidenceHash||actual!==evidenceHash)throw new Error('AUDIT_RESULT_ARTIFACT_HASH_INVALID');return artifact}
const safeLabel=s=>{const v=String(s??'').trim();if(!/^[A-Za-z0-9_.:-]{1,120}$/.test(v))throw new Error('AUDIT_LABEL_INVALID');return v};
const recordPath=label=>path.join(STATE_DIR,safeLabel(label)+'.json');
const readRecord=label=>{const p=recordPath(label);return fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'')):null};
function candidateFromPrompt(prompt){
  const hits=canonical(prompt).split('\n').map(x=>x.match(/^CANDIDATE:\s*(.+?)\s*$/)).filter(Boolean);
  if(hits.length!==1)throw new Error('AUDIT_PROMPT_CANDIDATE_REQUIRED_ONCE');
  const candidate=hits[0][1].trim();
  if(!candidate||candidate.includes('<')||candidate.length>160||/[\r\n\0]/.test(candidate))throw new Error('AUDIT_PROMPT_CANDIDATE_INVALID');
  return candidate;
}
function reviewKindFromPrompt(prompt){
  const hits=canonical(prompt).split('\n').map(x=>x.match(/^REVIEW_KIND:\s*(INDIE|DEEP_CONTRACT)\s*$/i)).filter(Boolean);
  if(hits.length!==1)throw new Error('AUDIT_PROMPT_REVIEW_KIND_REQUIRED_ONCE');
  return hits[0][1].toUpperCase();
}
function repositoryFromPrompt(prompt){
  const hits=canonical(prompt).split('\n').map(x=>x.match(/^REPOSITORY:\s*([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\s*$/)).filter(Boolean);
  if(hits.length!==1)throw new Error('AUDIT_PROMPT_REPOSITORY_REQUIRED_ONCE');
  return hits[0][1];
}
function prNumberFromPrompt(prompt){
  const hits=canonical(prompt).split('\n').map(x=>x.match(/^PR_NUMBER:\s*([1-9]\d*)\s*$/)).filter(Boolean);
  if(hits.length!==1)throw new Error('AUDIT_PROMPT_PR_NUMBER_REQUIRED_ONCE');
  return Number(hits[0][1]);
}
function promptField(prompt,...names){
  for(const name of names){const m=canonical(prompt).split('\n').map(x=>x.match(new RegExp('^'+name+'\\s*:\\s*(.+?)\\s*$','i'))).find(Boolean);if(m&&m[1]?.trim())return m[1].trim()}
  return null;
}
function riskSweepFamiliesFromPrompt(prompt,reviewKind){
  if(reviewKind!=='INDIE')return [];
  const raw=promptField(prompt,'RISK_SWEEP_FAMILIES');if(!raw||raw.toUpperCase()==='NONE')return [];
  const rows=[...new Set(raw.split(',').map(x=>x.trim()).filter(Boolean))].sort();
  if(!rows.length||rows.some(x=>!/^[A-Z0-9_:-]+$/.test(x)))throw new Error('AUDIT_RISK_SWEEP_FAMILIES_INVALID');
  return rows;
}
function validateRiskCoverage(result,expected){
  if(!Array.isArray(expected)||!expected.length)return result;
  const swept=result?.risk_families_swept,unswept=result?.unswept_risk_families;
  if(!Array.isArray(swept)||swept.some(x=>typeof x!=='string'||!x.trim()))throw new Error('AUDIT_RISK_FAMILIES_SWEPT_INVALID');
  if(!Array.isArray(unswept)||unswept.some(x=>typeof x!=='string'||!x.trim()))throw new Error('AUDIT_UNSWEPT_RISK_FAMILIES_INVALID');
  const missing=expected.filter(x=>!swept.includes(x));if(missing.length)throw new Error('AUDIT_REQUIRED_RISK_FAMILY_MISSING:'+missing.join(','));
  if(['PASS','FINDINGS'].includes(result?.verdict)&&unswept.length)throw new Error('AUDIT_PARTIAL_RISK_SWEEP_REQUIRES_HOLD');
  return result;
}
function assertIndieAdjacentBrief(prompt,reviewKind){
  if(reviewKind!=='INDIE')return;
  const required={
    reviewContext:promptField(prompt,'REVIEW_CONTEXT'),
    rootInvariant:promptField(prompt,'ROOT_INVARIANT'),
    riskFamily:promptField(prompt,'RISK_FAMILY'),
    adjacentSurfaces:promptField(prompt,'ADJACENT_SURFACES'),
    adjacentSweepResult:promptField(prompt,'ADJACENT_SWEEP_RESULT'),
    scopeReassess:promptField(prompt,'SCOPE_REASSESS'),
    adjacentImpactScope:promptField(prompt,'ADJACENT_IMPACT_SCOPE'),
    negativeCases:promptField(prompt,'NEGATIVE_CASES')
  };
  const missing=Object.entries(required).filter(([,v])=>!v).map(([k])=>k);
  if(missing.length)throw new Error('AUDIT_INDIE_ADJACENT_BRIEF_INVALID:'+missing.join(','));
  const context=String(required.reviewContext).trim().toUpperCase(),scope=String(required.scopeReassess).trim().toUpperCase();
  if(!['INITIAL','POST_FINDING'].includes(context))throw new Error('AUDIT_INDIE_REVIEW_CONTEXT_INVALID');
  if(!['NOT_REQUIRED','KEEP_BOUNDED','PROMOTE_CHILD','RECLASSIFY_HOST'].includes(scope))throw new Error('AUDIT_INDIE_SCOPE_REASSESS_INVALID');
  if(context==='POST_FINDING'&&(!promptField(prompt,'PRIOR_BLOCKING_REVIEW')||!promptField(prompt,'PRIOR_BLOCKING_FINDINGS')))throw new Error('AUDIT_INDIE_POST_FINDING_RECEIPT_REQUIRED');
  if(scope==='PROMOTE_CHILD'&&!promptField(prompt,'PROMOTED_JIRA_KEYS'))throw new Error('AUDIT_INDIE_PROMOTED_JIRA_KEYS_REQUIRED');
}
function validateIndieCoverage(result,enabled){
  if(!enabled)return result;
  if(!Array.isArray(result?.adjacent_paths_swept)||result.adjacent_paths_swept.length<1||!result.adjacent_paths_swept.every(x=>typeof x==='string'&&x.trim()))throw new Error('AUDIT_INDIE_ADJACENT_PATHS_SWEPT_INVALID');
  if(!Array.isArray(result?.adjacent_critical_paths_unchecked)||!result.adjacent_critical_paths_unchecked.every(x=>typeof x==='string'&&x.trim()))throw new Error('AUDIT_INDIE_ADJACENT_UNCHECKED_INVALID');
  if(['PASS','FINDINGS'].includes(result.verdict)&&result.adjacent_critical_paths_unchecked.length)throw new Error('AUDIT_INDIE_PARTIAL_SWEEP_REQUIRES_HOLD');
  return result;
}
function assertDeepExhaustiveBrief(prompt,reviewKind){
  if(reviewKind!=='DEEP_CONTRACT')return;
  const required={c6Reason:promptField(prompt,'C6_REASON'),materialInvariants:promptField(prompt,'MATERIAL_INVARIANTS','TRUST_BOUNDARIES'),stateMatrix:promptField(prompt,'STATE_MATRIX'),adversarialScenarios:promptField(prompt,'ADVERSARIAL_SCENARIOS'),evidenceScope:promptField(prompt,'EVIDENCE_SCOPE')};
  const missing=Object.entries(required).filter(([,v])=>!v).map(([k])=>k);
  if(missing.length)throw new Error('AUDIT_DEEP_EXHAUSTIVE_BRIEF_INVALID:'+missing.join(','));
}
function validateDeepCoverage(result,enabled){
  if(!enabled)return result;
  if(!Array.isArray(result?.invariant_families_swept)||result.invariant_families_swept.length<1||!result.invariant_families_swept.every(x=>typeof x==='string'&&x.trim()))throw new Error('AUDIT_DEEP_INVARIANT_FAMILIES_SWEPT_INVALID');
  if(!Array.isArray(result?.unswept_critical_paths)||!result.unswept_critical_paths.every(x=>typeof x==='string'&&x.trim()))throw new Error('AUDIT_DEEP_UNSWEPT_CRITICAL_PATHS_INVALID');
  if(['PASS','FINDINGS'].includes(result.verdict)&&result.unswept_critical_paths.length)throw new Error('AUDIT_DEEP_PARTIAL_SWEEP_REQUIRES_HOLD');
  return result;
}
function codexFallbackReceiptPath(reviewKind,candidate){return path.join(CODEX_FALLBACK_DIR,reviewKind+'-'+candidate+'.json')}
function assertReusedCapacityProvenance(r){
  if(r?.capacityEvidenceReused!==true){if(r?.codexAttemptedForCandidate===false)throw new Error('AUDIT_FALLBACK_REUSED_CAPACITY_FLAG_INVALID');return;}
  if(r.codexAttemptedForCandidate!==false||r.capacityDomain!=='openai:vmtct97')throw new Error('AUDIT_FALLBACK_REUSED_CAPACITY_BINDING_INVALID');
  const resetAt=Date.parse(r.resetAt??'');if(!Number.isFinite(resetAt)||resetAt<=Date.now())throw new Error('AUDIT_FALLBACK_REUSED_CAPACITY_EXPIRED');
  const observationPath=String(r.capacityObservationPath??'');if(!observationPath||!path.isAbsolute(observationPath)||!fs.existsSync(observationPath))throw new Error('AUDIT_FALLBACK_REUSED_CAPACITY_OBSERVATION_REQUIRED');
  let observation;try{observation=JSON.parse(fs.readFileSync(observationPath,'utf8').replace(/^\uFEFF/,''))}catch{throw new Error('AUDIT_FALLBACK_REUSED_CAPACITY_OBSERVATION_INVALID_JSON')}
  const observationHash=crypto.createHash('sha256').update(stable(observation)).digest('hex');
  if(!r.capacityObservationHash||observationHash!==r.capacityObservationHash||observation?.schemaVersion!==1||observation?.kind!=='PINO_CODEX_CAPACITY_OBSERVATION'||observation?.provider!=='OPENAI_CODEX'||observation?.capacityDomain!=='openai:vmtct97'||observation?.profileId!=='vmtct97'||observation?.state!=='EXHAUSTED'||observation?.allAuthenticatedProfilesExhausted!==true||observation?.resetAt!==r.resetAt||observation?.observedAt!==r.sourceCapacityObservedAt||observation?.sourceReceiptHash!==r.sourceCapacityReceiptHash)throw new Error('AUDIT_FALLBACK_REUSED_CAPACITY_OBSERVATION_BINDING_INVALID');
  if(!observation.providerEvidence||observation.providerEvidenceSha256!==crypto.createHash('sha256').update(String(observation.providerEvidence)).digest('hex'))throw new Error('AUDIT_FALLBACK_REUSED_CAPACITY_PROVIDER_EVIDENCE_INVALID');
  const sourcePath=String(r.sourceCapacityReceiptPath??'');if(!sourcePath||sourcePath!==observation.sourceReceiptPath||!fs.existsSync(sourcePath))throw new Error('AUDIT_FALLBACK_REUSED_CAPACITY_SOURCE_RECEIPT_REQUIRED');
  let source;try{source=JSON.parse(fs.readFileSync(sourcePath,'utf8').replace(/^\uFEFF/,''))}catch{throw new Error('AUDIT_FALLBACK_REUSED_CAPACITY_SOURCE_RECEIPT_INVALID_JSON')}
  const sourceHash=crypto.createHash('sha256').update(stable(source)).digest('hex');
  if(sourceHash!==r.sourceCapacityReceiptHash||source?.schemaVersion!==1||source?.kind!=='PINO_CODEX_FALLBACK_ELIGIBILITY'||source?.exitClass!=='CAPACITY_EXHAUSTED'||source?.allAuthenticatedProfilesExhausted!==true||!Array.isArray(source?.profilesAttempted)||source.profilesAttempted.length<1||source.createdAt!==r.sourceCapacityObservedAt)throw new Error('AUDIT_FALLBACK_REUSED_CAPACITY_SOURCE_RECEIPT_BINDING_INVALID');
}
function assertCodexFallbackEligible({reviewKind,candidate,repository}){
  const p=codexFallbackReceiptPath(reviewKind,candidate);
  if(!fs.existsSync(p))throw new Error('AUDIT_FALLBACK_FORBIDDEN_CODEX_CAPACITY_RECEIPT_REQUIRED');
  let r;try{r=JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''))}catch{throw new Error('AUDIT_FALLBACK_CODEX_RECEIPT_INVALID_JSON')}
  if(r?.schemaVersion!==1||r?.kind!=='PINO_CODEX_FALLBACK_ELIGIBILITY'||r?.reviewKind!==reviewKind||r?.candidate!==candidate||r?.repository!==repository||r?.exitClass!=='CAPACITY_EXHAUSTED'||r?.allAuthenticatedProfilesExhausted!==true||!Array.isArray(r?.profilesAttempted)||r.profilesAttempted.length<1||!Array.isArray(r?.requiredRiskFamilies)||!/^[0-9a-f]{64}$/i.test(String(r?.riskContractHash??'')))throw new Error('AUDIT_FALLBACK_CODEX_RECEIPT_BINDING_INVALID');
  const at=Date.parse(r.createdAt??'');
  if(!Number.isFinite(at)||Date.now()-at<0||Date.now()-at>CODEX_FALLBACK_MAX_AGE_MS)throw new Error('AUDIT_FALLBACK_CODEX_RECEIPT_STALE');
  if(!/^[0-9a-f-]{36}$/i.test(String(r.codexSourceThreadId??''))||!/^[0-9a-f]{64}$/i.test(String(r.codexSourceReceiptSha256??''))||!/^[0-9a-f]{64}$/i.test(String(r.reviewObligationKey??'')))throw new Error('AUDIT_FALLBACK_CODEX_SOURCE_BINDING_MISSING');
  const source=runWslPython(REVIEW_SOURCE_VERIFIER_WSL,['codex-capacity','--thread',r.codexSourceThreadId,'--candidate',candidate,'--expected-hash',r.codexSourceReceiptSha256,'--risk-hash',r.riskContractHash,'--risk-families-json',JSON.stringify(r.requiredRiskFamilies)]);
  if(source.sourceReceiptSha256!==r.codexSourceReceiptSha256||source.riskContractHash!==r.riskContractHash||stable(source.requiredRiskFamilies)!==stable(r.requiredRiskFamilies))throw new Error('AUDIT_FALLBACK_CODEX_SOURCE_BINDING_INVALID');
  return {path:p,sha256:crypto.createHash('sha256').update(stable(r)).digest('hex'),receipt:r,source};
}
function claimChatgptObligation({reviewKind,repository,prNumber,candidate,riskHash,candidateVector,fallback,label}){
  const args=['claim-chatgpt','--review-kind',reviewKind,'--repository',repository,'--pr',String(prNumber),'--candidate',candidate,'--risk-hash',riskHash,'--capacity-receipt-hash',fallback.sha256,'--label',label];if(candidateVector?.length)args.push('--vector-json',JSON.stringify(candidateVector));
  const claim=runWslPython(REVIEW_OBLIGATION_HELPER_WSL,args);if(claim.obligationKey!==fallback.receipt.reviewObligationKey)throw new Error('AUDIT_OBLIGATION_KEY_MISMATCH');return claim;
}
function markChatgptObligationTerminal(record,verdict,authorityHash){
  if(!record.reviewObligationKey||!record.reviewObligationToken)throw new Error('AUDIT_OBLIGATION_TOKEN_MISSING');return runWslPython(REVIEW_OBLIGATION_HELPER_WSL,['terminal','--key',record.reviewObligationKey,'--token',record.reviewObligationToken,'--provider','CHATGPT','--verdict',verdict,'--authority-hash',authorityHash]);
}
function ghJson(args,{timeout=60000}={}){
  const x=spawnSync(GH,args,{encoding:'utf8',timeout,windowsHide:true,maxBuffer:8*1024*1024});
  if(x.status!==0)throw new Error('AUDIT_GITHUB_CLI_FAILED:'+(x.stderr||x.stdout||x.error?.message||x.status));
  return x.stdout?.trim()?JSON.parse(x.stdout):null;
}
function canonicalCommentSnapshot({repository,prNumber,reviewKind,candidate}){
  const marker='<!-- PINO_CANONICAL_AUDIT mode='+reviewKind+' candidate='+candidate+' -->';
  const raw=ghJson(['api','--paginate','--slurp','repos/'+repository+'/issues/'+prNumber+'/comments?per_page=100'])??[];
  const rows=raw.flatMap(x=>Array.isArray(x)?x:[x]).filter(Boolean);
  const matches=rows.filter(x=>String(x.body??'').includes(marker));
  if(matches.length>1)throw new Error('AUDIT_CANONICAL_COMMENT_DUPLICATE_PREEXISTING');
  if(!matches.length)return null;
  const c=matches[0];
  return {commentId:c.id??null,updatedAt:c.updated_at??null,bodySha256:crypto.createHash('sha256').update(String(c.body??'')).digest('hex')};
}
function publicationContract({reviewKind,repository,prNumber,candidate}){
  const indie=reviewKind==='INDIE',deep=reviewKind==='DEEP_CONTRACT';
  const modeFields=indie?',"adjacent_paths_swept":["<changed/adjacent path>"],"adjacent_critical_paths_unchecked":[]'+indieFullAxisResultFields():deep?',"invariant_families_swept":["<family>"],"unswept_critical_paths":[]':'';
  const modeInstruction=indie?'\nPAP-454 Rule B is mandatory: review ROOT_INVARIANT + RISK_FAMILY as the semantic target, not merely the literal patch. Treat PRIOR_BLOCKING_FINDINGS as RCA seeds. Independently challenge ADJACENT_SURFACES + ADJACENT_SWEEP_RESULT + ADJACENT_IMPACT_SCOPE + NEGATIVE_CASES across sibling verbs/entities/authority dimensions. Detect invariant/authority/artifact/failure-domain/proof-burden escalation and return blocking FINDINGS/HOLD if the declared SCOPE_REASSESS is missing or not credible. PASS or FINDINGS requires adjacent_paths_swept and adjacent_critical_paths_unchecked=[]; if a material adjacent path cannot be inspected, return HOLD.'+indieFullAxisInstruction():deep?'\nDeep CONTRACT exhaustive sweep is mandatory: sweep every material invariant family across sibling paths and high-risk pairwise/critical-triple states; do not stop at the first blocker. PASS or FINDINGS requires invariant_families_swept and unswept_critical_paths=[]; if any material critical path cannot be inspected, return HOLD.':'';
  return `CANONICAL_PR_COMMENT_PUBLICATION (MANDATORY)
The canonical audit result is the PR comment on ${repository}#${prNumber}, not this chat response.
Your only permitted write side effect is to create or update that one canonical audit comment. Do not push commits, modify branches, labels, approvals, merge/close state, or remediate code.
Before terminal verdict, find comments with exact marker:
<!-- PINO_CANONICAL_AUDIT mode=${reviewKind} candidate=${candidate} -->
If zero exist, create one; if exactly one exists, update it; if more than one exists, return HOLD with DUPLICATE_CANONICAL_AUDIT_COMMENTS.
The comment must contain exactly one line:
PINO_AUDIT_RESULT_JSON={"schemaVersion":1,"repository":${JSON.stringify(repository)},"pr_number":${prNumber},"review_kind":${JSON.stringify(reviewKind)},"candidate":${JSON.stringify(candidate)},"verdict":"PASS|FINDINGS|HOLD","p0":0,"p1":0,"blocking_findings":[]${modeFields},"summary":"<bounded summary>"}${modeInstruction}
Read the exact comment back and verify repository, PR, review kind, candidate and verdict. If publication/readback is unavailable or unverified, return HOLD with CANONICAL_PR_COMMENT_UNVERIFIED and do not claim consumable PASS.
After successful readback, end this response with exactly one AUDIT_RESULT_JSON line mirroring the canonical comment.`;
}
const resultPath=record=>path.join(RESULT_DIR,record.reviewKey+'.result.json');
const directInboxPath=record=>path.join(STATE_DIR,'inbox',record.reviewKey+'.auditor.json');
function validateDirectPublishedFile(record,payload){
  if(payload?.schemaVersion!==1||payload?.kind!=='PINO_CHATGPT_AUDITOR_PUBLISHED_RESULT')throw new Error('AUDIT_DIRECT_FILE_SCHEMA_INVALID');
  for(const [k,v] of [['label',record.label],['reviewKind',record.reviewKind],['repository',record.repository],['candidate',record.candidate],['reviewKey',record.reviewKey],['projectId',record.projectId]]) if(payload[k]!==v)throw new Error('AUDIT_DIRECT_FILE_BINDING_MISMATCH:'+k);
  if(payload.prNumber!==record.prNumber)throw new Error('AUDIT_DIRECT_FILE_BINDING_MISMATCH:prNumber');
  if(payload.sourcePromptSha256!==(record.sourcePromptSha256??record.promptSha256))throw new Error('AUDIT_DIRECT_FILE_BINDING_MISMATCH:sourcePromptSha256');
  if(!['PASS','FINDINGS','HOLD'].includes(payload.verdict)||!Number.isInteger(payload.p0)||payload.p0<0||!Number.isInteger(payload.p1)||payload.p1<0||!Array.isArray(payload.blocking_findings)||!payload.blocking_findings.every(x=>typeof x==='string')||typeof payload.summary!=='string'||!payload.summary.trim()||!Number.isFinite(Date.parse(payload.publishedAt??'')))throw new Error('AUDIT_DIRECT_FILE_RESULT_INVALID');
  if(payload.verdict==='PASS'&&(payload.p0!==0||payload.p1!==0||payload.blocking_findings.length))throw new Error('AUDIT_DIRECT_FILE_PASS_NOT_CLEAN');
  validateIndieCoverage(payload,record.indieAdjacentV1===true);
  validateIndieFullAxisCoverage(payload,record.indieFullAxisV1===true);
  validateRiskCoverage(payload,record.riskSweepFamilies??[]);
  validateDeepCoverage(payload,record.deepExhaustiveV1===true);
  const inboxEvidenceHash=crypto.createHash('sha256').update(stable(payload)).digest('hex');
  return {...payload,inboxEvidenceHash};
}
function useLegacyIndieStartContract(record,reviewKind,resultTransport){return !!record&&reviewKind==='INDIE'&&resultTransport==='AUDIT_CHAT_V1'&&record.publicationAuthority==='AUDIT_CHAT_V1'&&record.indieFullAxisV1!==true}
function legacyIndieDirectPublishContractV0({label,reviewKind,repository,prNumber,candidate,sourcePromptSha256,reviewKey,riskSweepFamilies=[]}){
  const indie=reviewKind==='INDIE',deep=reviewKind==='DEEP_CONTRACT',riskFields=indie&&riskSweepFamilies.length?',"risk_families_swept":'+JSON.stringify(riskSweepFamilies)+',"unswept_risk_families":[]':'';
  const modeFields=(indie?',"adjacent_paths_swept":["<changed/adjacent path>"],"adjacent_critical_paths_unchecked":[]':deep?',"invariant_families_swept":["<family>"],"unswept_critical_paths":[]':'')+riskFields;
  const riskInstruction=indie&&riskSweepFamilies.length?' Required V3 risk families: '+riskSweepFamilies.join(', ')+'. PASS or FINDINGS requires risk_families_swept to cover all of them and unswept_risk_families=[]; otherwise HOLD.':'';
  const modeInstruction=(indie?' PAP-454 Rule B is mandatory: use ROOT_INVARIANT + RISK_FAMILY as the semantic target; treat PRIOR_BLOCKING_FINDINGS as RCA seeds rather than literal patch instructions; independently challenge ADJACENT_SURFACES + ADJACENT_SWEEP_RESULT + ADJACENT_IMPACT_SCOPE + NEGATIVE_CASES across sibling verbs/entities/authority dimensions. Detect invariant/authority/artifact/failure-domain/proof-burden escalation and return blocking FINDINGS/HOLD if SCOPE_REASSESS is missing or not credible. PASS or FINDINGS requires adjacent_paths_swept and adjacent_critical_paths_unchecked=[]; if a material adjacent path cannot be inspected, return HOLD.':deep?' Deep CONTRACT exhaustive sweep is mandatory: use MATERIAL_INVARIANTS/TRUST_BOUNDARIES + STATE_MATRIX + ADVERSARIAL_SCENARIOS + EVIDENCE_SCOPE as one bounded surface; sweep sibling paths and high-risk pairwise/critical-triple combinations; do not stop at the first blocker. PASS or FINDINGS requires invariant_families_swept and unswept_critical_paths=[]; if any material critical path cannot be inspected, return HOLD.':'')+riskInstruction;
  return `AUDIT_CHAT_RESULT (CANONICAL TRANSPORT)
The canonical result source is this exact Audit conversation terminal response. Do not write any local inbox/result artifact, PR comment, repository state, PAC state, or filesystem result.
Bind your review to label=${label}, reviewKind=${reviewKind}, repository=${repository}, prNumber=${prNumber}, candidate=${candidate}, sourcePromptSha256=${sourcePromptSha256}, reviewKey=${reviewKey}.
End with exactly one final line in this exact marker form and no prose after it:\nAUDIT_RESULT_JSON={"verdict":"PASS|FINDINGS|HOLD","candidate":${JSON.stringify(candidate)},"p0":0,"p1":0,"blocking_findings":[]${modeFields},"summary":"<bounded non-empty summary>"}
PASS is valid only with p0=0, p1=0, blocking_findings=[].${modeInstruction} The terminal Audit message itself is authoritative; transport/tool availability must not change the substantive verdict.`;
}
function directPublishContract({label,reviewKind,repository,prNumber,candidate,sourcePromptSha256,reviewKey,riskSweepFamilies=[]}){
  const indie=reviewKind==='INDIE',deep=reviewKind==='DEEP_CONTRACT',riskFields=indie&&riskSweepFamilies.length?',"risk_families_swept":'+JSON.stringify(riskSweepFamilies)+',"unswept_risk_families":[]':'';
  const modeFields=(indie?',"adjacent_paths_swept":["<changed/adjacent path>"],"adjacent_critical_paths_unchecked":[]'+indieFullAxisResultFields():deep?',"invariant_families_swept":["<family>"],"unswept_critical_paths":[]':'')+riskFields;
  const riskInstruction=indie&&riskSweepFamilies.length?' Required V3 risk families: '+riskSweepFamilies.join(', ')+'. PASS or FINDINGS requires risk_families_swept to cover all of them and unswept_risk_families=[]; otherwise HOLD.':'';
  const modeInstruction=(indie?' PAP-454 Rule B is mandatory: use ROOT_INVARIANT + RISK_FAMILY as the semantic target; treat PRIOR_BLOCKING_FINDINGS as RCA seeds rather than literal patch instructions; independently challenge ADJACENT_SURFACES + ADJACENT_SWEEP_RESULT + ADJACENT_IMPACT_SCOPE + NEGATIVE_CASES across sibling verbs/entities/authority dimensions. Detect invariant/authority/artifact/failure-domain/proof-burden escalation and return blocking FINDINGS/HOLD if SCOPE_REASSESS is missing or not credible. PASS or FINDINGS requires adjacent_paths_swept and adjacent_critical_paths_unchecked=[]; if a material adjacent path cannot be inspected, return HOLD.'+indieFullAxisInstruction():deep?' Deep CONTRACT exhaustive sweep is mandatory: use MATERIAL_INVARIANTS/TRUST_BOUNDARIES + STATE_MATRIX + ADVERSARIAL_SCENARIOS + EVIDENCE_SCOPE as one bounded surface; sweep sibling paths and high-risk pairwise/critical-triple combinations; do not stop at the first blocker. PASS or FINDINGS requires invariant_families_swept and unswept_critical_paths=[]; if any material critical path cannot be inspected, return HOLD.':'')+riskInstruction;
  return `AUDIT_CHAT_RESULT (CANONICAL TRANSPORT)
The canonical result source is this exact Audit conversation terminal response. Do not write any local inbox/result artifact, PR comment, repository state, PAC state, or filesystem result.
Bind your review to label=${label}, reviewKind=${reviewKind}, repository=${repository}, prNumber=${prNumber}, candidate=${candidate}, sourcePromptSha256=${sourcePromptSha256}, reviewKey=${reviewKey}.
End with exactly one final line in this exact marker form and no prose after it:\nAUDIT_RESULT_JSON={"verdict":"PASS|FINDINGS|HOLD","candidate":${JSON.stringify(candidate)},"p0":0,"p1":0,"blocking_findings":[]${modeFields},"summary":"<bounded non-empty summary>"}
PASS is valid only with p0=0, p1=0, blocking_findings=[].${modeInstruction} The terminal Audit message itself is authoritative; transport/tool availability must not change the substantive verdict.`;
}
function resultTransportFromPrompt(prompt){
  const hits=canonical(prompt).split('\n').map(x=>x.match(/^RESULT_TRANSPORT:\s*(AUDIT_CHAT_V1|AUDITOR_PUBLISHED_V1|CHATGPT_TERMINAL_V1)\s*$/i)).filter(Boolean);
  if(hits.length>1)throw new Error('AUDIT_PROMPT_RESULT_TRANSPORT_DUPLICATE');
  const requested=hits.length?hits[0][1].toUpperCase():'AUDIT_CHAT_V1';
  return requested==='AUDITOR_PUBLISHED_V1'?'AUDIT_CHAT_V1':requested;
}
const publicationPath=record=>path.join(RESULT_DIR,record.reviewKey+'.publication.json');
function writeRecord(label,record,{create=false}={}){
  fs.mkdirSync(STATE_DIR,{recursive:true});const p=recordPath(label),body=JSON.stringify(record,null,2)+'\n';
  if(create){fs.writeFileSync(p,body,{flag:'wx'});return}
  const tmp=p+'.tmp-'+process.pid+'-'+crypto.randomUUID();
  fs.writeFileSync(tmp,body);
  let lastError=null;
  for(let i=0;i<6;i++){
    try{fs.renameSync(tmp,p);return}
    catch(error){
      lastError=error;
      if(!['EPERM','EACCES'].includes(error?.code))break;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,50*(i+1));
    }
  }
  if(['EPERM','EACCES'].includes(lastError?.code)){
    fs.writeFileSync(p,body);
    try{fs.unlinkSync(tmp)}catch{}
    return;
  }
  try{fs.unlinkSync(tmp)}catch{}
  throw lastError;
}
async function request(route,{method='GET',body}={}){
  const r=await fetch(GATEWAY+route,{method,headers:{authorization:`Bearer ${TOKEN}`,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const t=await r.text();let j;try{j=JSON.parse(t)}catch{j={raw:t}};
  if(!r.ok)throw new Error(`${route}:${r.status}:${j.error??t}`);return j;
}
async function submitIntent(intent,timeoutMs=120000){
  const submitted=await request('/v1/intents',{method:'POST',body:{schemaVersion:1,...intent}});
  const deadline=Date.now()+timeoutMs;
  while(Date.now()<deadline){
    const state=await request('/v1/actions/'+encodeURIComponent(submitted.actionId));
    if(state.receipt){
      const evidenceJson=String(state.receipt.evidence_json??'');let evidence={};try{evidence=JSON.parse(evidenceJson)}catch{}
      return {actionId:submitted.actionId,coalesced:submitted.coalesced===true,outcome:state.receipt.outcome,evidence,receiptId:state.receipt.receipt_id??null,receiptCreatedAt:state.receipt.created_at??null,receiptEvidenceJson:evidenceJson,receiptEvidenceSha256:crypto.createHash('sha256').update(evidenceJson).digest('hex')};
    }
    await sleep(250);
  }
  throw new Error('AUDIT_ACTION_TIMEOUT:'+submitted.actionId);
}
function assertSameReview(existing,{candidate,promptSha256,reviewKind,repository,prNumber,reviewKey}){
  if(existing.candidate!==candidate||existing.promptSha256!==promptSha256||existing.reviewKind!==reviewKind||existing.repository!==repository||existing.prNumber!==prNumber||existing.reviewKey!==reviewKey)throw new Error('AUDIT_LABEL_CONFLICT');
}
function present(record,extra={}){
  console.log(JSON.stringify({ok:record.outcome==='CONFIRMED',label:record.label,candidate:record.candidate,promptSha256:record.promptSha256,reviewKey:record.reviewKey,conversationId:record.conversationId??null,outcome:record.outcome,state:record.state,...extra},null,2));
}
async function startAudit(promptPath,labelRaw,requesterConversationIdArg,requesterConversationUrlArg){
  if(!promptPath||!fs.existsSync(promptPath))throw new Error('AUDIT_PROMPT_FILE_REQUIRED');
  const label=safeLabel(labelRaw),sourcePrompt=canonical(fs.readFileSync(promptPath,'utf8').replace(/^\uFEFF/,''));
  if(sourcePrompt.length<200)throw new Error('AUDIT_PROMPT_TOO_SHORT');
  const candidate=candidateFromPrompt(sourcePrompt),reviewKind=reviewKindFromPrompt(sourcePrompt),repository=repositoryFromPrompt(sourcePrompt),prNumber=prNumberFromPrompt(sourcePrompt),resultTransport=resultTransportFromPrompt(sourcePrompt),riskSweepFamilies=riskSweepFamiliesFromPrompt(sourcePrompt,reviewKind);
  const reviewExperiment=parseReviewChainShortPrompt(sourcePrompt);
  const existingRecord=readRecord(label);
  const reviewVectorBinding=(reviewExperiment||existingRecord)?{candidateVector:null,candidateVectorHash:null}:candidateVectorBindingFromEnv(repository,prNumber,candidate);
  const reuseFallback=(reviewExperiment||existingRecord)?null:assertFreshReviewRequired({reviewKind,repository,prNumber,candidate,riskSweepFamilies,candidateVector:reviewVectorBinding.candidateVector});
  if(reviewExperiment){if(reviewKind!=='INDIE')throw new Error('REVIEW_CHAIN_SHORT_REVIEW_KIND_INVALID');}
  else assertIndieAdjacentBrief(sourcePrompt,reviewKind);
  assertDeepExhaustiveBrief(sourcePrompt,reviewKind);
  const sourcePromptSha256=sha(sourcePrompt);
  const provisionalReviewKey=sha(PROJECT_ID+'\0'+label+'\0'+reviewKind+'\0'+repository+'\0'+prNumber+'\0'+candidate+'\0'+sourcePromptSha256).slice(0,40);
  const legacyIndieStart=useLegacyIndieStartContract(existingRecord,reviewKind,resultTransport);
  const contract=resultTransport==='AUDIT_CHAT_V1'?(reviewExperiment?reviewChainShortContract({candidate,experiment:reviewExperiment}):(legacyIndieStart?legacyIndieDirectPublishContractV0:directPublishContract)({label,reviewKind,repository,prNumber,candidate,sourcePromptSha256,reviewKey:provisionalReviewKey,riskSweepFamilies})):'';
  const promptBase=resultTransport==='AUDIT_CHAT_V1'?sourcePrompt+'\n\n'+contract:sourcePrompt;
  const sourceBinding=reuseFallback?'\n\nPINO_REVIEW_SOURCE_BINDING\nPINO_RISK_CONTRACT_HASH: '+reuseFallback.receipt.riskContractHash+'\nPINO_REQUIRED_RISK_FAMILIES_JSON: '+JSON.stringify(reuseFallback.receipt.requiredRiskFamilies):(existingRecord?.riskContractHash?'\n\nPINO_REVIEW_SOURCE_BINDING\nPINO_RISK_CONTRACT_HASH: '+existingRecord.riskContractHash+'\nPINO_REQUIRED_RISK_FAMILIES_JSON: '+JSON.stringify(existingRecord.requiredRiskFamilies??[]):'');
  const prompt=promptBase+sourceBinding;
  const promptSha256=sha(prompt),promptArtifact=reuseFallback?materializePromptArtifact(prompt,sha(prompt)):null;
  const reviewKey=resultTransport==='AUDIT_CHAT_V1'?provisionalReviewKey:sha(PROJECT_ID+'\0'+label+'\0'+reviewKind+'\0'+repository+'\0'+prNumber+'\0'+candidate+'\0'+promptSha256).slice(0,40);
  const requesterConversationId=String(requesterConversationIdArg??'').trim()||null;
  const requesterConversationUrl=String(requesterConversationUrlArg??'').trim()||null;
  if((requesterConversationId&&!requesterConversationUrl)||(!requesterConversationId&&requesterConversationUrl))throw new Error('AUDIT_REQUESTER_BINDING_REQUIRES_ID_AND_URL');
  const requesterSource=requesterConversationId?'CALLER_EXACT':null;
  let record=existingRecord,codexFallback=reuseFallback;
  if(record){
    assertSameReview(record,{candidate,promptSha256,reviewKind,repository,prNumber,reviewKey});
    if(['QUEUED','WAITING_ADMISSION','START_SUBMITTED','COALESCED_WAITING'].includes(record.state)&&record.queueReceipt){console.log(JSON.stringify({...record.queueReceipt,idempotent:true,admissionState:record.admissionStatus??record.state},null,2));return}
    if(record.state==='CONFIRMED'||record.state==='TERMINAL'){present(record,{idempotent:true,terminalDirective:'YIELD_NOW',yieldCondition:'START_CONFIRMED'});return}
    if(canSafeRetryStart(record)){
      const previous={actionId:record.actionId??null,outcome:record.outcome??null,failure:record.failure??null,updatedAt:record.updatedAt??null};
      const retryCount=safeStartRetryCount(record)+1;
      record={...record,state:'STARTING',outcome:null,actionId:null,failure:null,safeStartRetryCount:retryCount,safeStartRetryHistory:[...(record.safeStartRetryHistory??[]),previous],safeStartRetryAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
      writeRecord(label,record);
    }else{
      if(isSafeNoWriteStartRecord(record)&&safeStartRetryCount(record)>=DEFAULT_MAX_SAFE_START_RETRIES)throw new Error('AUDIT_START_SAFE_RETRY_EXHAUSTED:'+label);
      if(record.state==='BOOTSTRAP_OUTCOME_UNKNOWN')throw new Error('AUDIT_BOOTSTRAP_UNCERTAIN_RECONCILE_REQUIRED:'+label);
      if(record.state==='DISPATCH_OUTCOME_UNKNOWN'||record.state==='OUTCOME_UNKNOWN')throw new Error('AUDIT_DISPATCH_UNCERTAIN_RECONCILE_REQUIRED:'+label);
      if(record.state==='BOOTSTRAP_FAILED_SAFE'||record.state==='DISPATCH_FAILED_SAFE')throw new Error('AUDIT_MANUAL_RECOVERY_REQUIRED:'+label);
      if(record.state==='VERIFY_FAILED')throw new Error('AUDIT_START_SAFE_RETRY_REQUIRES_NEW_LABEL:'+label);
      if(record.state==='STARTING'&&!fs.existsSync(QUEUE_DISABLE_FLAG))throw new Error('AUDIT_START_INCOMPLETE_QUEUE_MODE:'+label);
    }
  }
  else{
    const now=new Date().toISOString();
    if(reviewExperiment){
      record={schemaVersion:1,label,projectId:PROJECT_ID,reviewKind,repository,prNumber,candidate,promptSha256,sourcePromptSha256,reviewKey,promptPath:path.resolve(promptPath),publicationAuthority:resultTransport,indieAdjacentV1:false,indieFullAxisV1:false,riskSweepFamilies:[],deepExhaustiveV1:false,state:'STARTING',outcome:null,createdAt:now,updatedAt:now,
        primaryGptIndie:false,providerPolicy:'EXPERIMENT_REVIEW_CHAIN_SHORT_V1',reviewExperiment:'REVIEW_CHAIN_SHORT_V1',reviewExperimentKey:reviewExperiment.key,hostJiraKey:reviewExperiment.host,reviewPurpose:reviewExperiment.purpose,originalCodexAuthorityPath:reviewExperiment.authorityPath,originalCodexEvidenceHash:reviewExperiment.authorityHash,originalCodexCandidate:reviewExperiment.original};
    }else{
      codexFallback??=assertCodexFallbackEligible({reviewKind,candidate,repository});
      const obligation=claimChatgptObligation({reviewKind,repository,prNumber,candidate,riskHash:codexFallback.receipt.riskContractHash,candidateVector:reviewVectorBinding.candidateVector,fallback:codexFallback,label});
      record={schemaVersion:1,label,projectId:PROJECT_ID,reviewKind,repository,prNumber,candidate,...reviewVectorBinding,promptSha256,sourcePromptSha256,reviewKey,promptPath:path.resolve(promptPath),promptArtifactPath:promptArtifact?.windows??null,promptArtifactWsl:promptArtifact?.wsl??null,publicationAuthority:resultTransport,indieAdjacentV1:reviewKind==='INDIE',indieFullAxisV1:reviewKind==='INDIE',riskSweepFamilies,deepExhaustiveV1:reviewKind==='DEEP_CONTRACT',state:'STARTING',outcome:null,createdAt:now,updatedAt:now,
        primaryGptIndie:false,providerPolicy:'CODEX_FIRST_CHATGPT_FALLBACK',requiredRiskFamilies:codexFallback.receipt.requiredRiskFamilies??[],riskContractHash:codexFallback.receipt.riskContractHash??null,reviewObligationKey:obligation.obligationKey,reviewObligationToken:obligation.token,
        codexFallbackReceiptPath:codexFallback?.path??null,codexFallbackReceiptSha256:codexFallback?.sha256??null,codexFallbackProfiles:codexFallback?.receipt?.profilesAttempted??[]};
    }
    writeRecord(label,record,{create:true});
  }
  if(!reviewExperiment&&!codexFallback){
    codexFallback=assertCodexFallbackEligible({reviewKind,candidate,repository});
    if(record.codexFallbackReceiptSha256&&record.codexFallbackReceiptSha256!==codexFallback.sha256)throw new Error('AUDIT_FALLBACK_CODEX_RECEIPT_CHANGED');
    record={...record,primaryGptIndie:false,providerPolicy:'CODEX_FIRST_CHATGPT_FALLBACK',requiredRiskFamilies:codexFallback.receipt.requiredRiskFamilies??record.requiredRiskFamilies??[],riskContractHash:codexFallback.receipt.riskContractHash??record.riskContractHash??null,codexFallbackReceiptPath:codexFallback.path,codexFallbackReceiptSha256:codexFallback.sha256,codexFallbackProfiles:codexFallback.receipt.profilesAttempted,updatedAt:new Date().toISOString()};
    writeRecord(label,record);
  }
  if(fs.existsSync(QUEUE_DISABLE_FLAG)){
    // Backward compatibility only: finish a review that already consumed the historical hello bootstrap.
    if(record.state==='BOOTSTRAP_CONFIRMED'){
      const result=await submitIntent({
        action:'chatgpt.audit.continue',
        target:{project:'Audit',reviewKey},
        payload:{conversationId:record.conversationId,conversationUrl:record.url,prompt,promptSha256},
        priority:2,maxRetries:0,idempotencyKey:`chatgpt-audit/dispatch/${reviewKey}`
      },300000);
      if(result.outcome!=='CONFIRMED'){
        const safe=result.outcome==='VERIFY_FAILED';
        record={...record,actionId:result.actionId,state:safe?'DISPATCH_FAILED_SAFE':'DISPATCH_OUTCOME_UNKNOWN',outcome:result.outcome,failure:result.evidence,updatedAt:new Date().toISOString()};
        writeRecord(label,record);
        throw new Error((safe?'AUDIT_PROMPT_DISPATCH_FAILED_SAFE:':'AUDIT_PROMPT_DISPATCH_NOT_CONFIRMED:')+result.outcome);
      }
      const e=result.evidence??{};
      if(e.conversationId!==record.conversationId||e.promptSha256!==promptSha256||!String(e.url??record.url??'').includes('/c/'+record.conversationId))throw new Error('AUDIT_PROMPT_DISPATCH_RECEIPT_BINDING_INVALID');
      record={...record,actionId:result.actionId,state:'CONFIRMED',outcome:'CONFIRMED',url:e.url??record.url,targetId:e.targetId??record.targetId??null,
        confirmedAt:new Date().toISOString(),auditPromptAcceptedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),mode:'HELLO_BOOTSTRAP_LEGACY'};
      writeRecord(label,record);
      present(record,{terminalDirective:'YIELD_NOW',yieldCondition:'START_CONFIRMED',mode:'HELLO_BOOTSTRAP_LEGACY',bootstrapYielded:true});
      return;
    }

    // Canonical new-start path: the immutable audit prompt is the first user turn.
    const result=await submitIntent({
      action:'chatgpt.audit.start',
      target:{project:'Audit',reviewKey},
      payload:{projectId:PROJECT_ID,label,candidate,prompt,promptSha256,reviewKey},
      priority:2,maxRetries:0,idempotencyKey:retryIdempotencyKey(reviewKey,safeStartRetryCount(record))
    },300000);
    if(result.outcome!=='CONFIRMED'){
      const safe=result.outcome==='VERIFY_FAILED';
      record={...record,actionId:result.actionId,state:safe?'VERIFY_FAILED':'OUTCOME_UNKNOWN',outcome:result.outcome,failure:result.evidence,updatedAt:new Date().toISOString(),mode:'PROMPT_FIRST_DIRECT'};
      writeRecord(label,record);
      if(!safe&&isSafeNoWriteStartResult(result)&&safeStartRetryCount(record)<DEFAULT_MAX_SAFE_START_RETRIES)return await startAudit(promptPath,labelRaw,requesterConversationIdArg,requesterConversationUrlArg);
      throw new Error((safe?'AUDIT_START_FAILED_SAFE:':'AUDIT_START_NOT_CONFIRMED:')+result.outcome);
    }
    const e=result.evidence??{};
    if(!e.conversationId||e.promptSha256!==promptSha256||e.candidate!==candidate||!String(e.url??'').includes('/c/'+e.conversationId))throw new Error('AUDIT_START_RECEIPT_BINDING_INVALID');
    record={...record,actionId:result.actionId,state:'CONFIRMED',outcome:'CONFIRMED',conversationId:e.conversationId,url:e.url,targetId:e.targetId??null,
      confirmedAt:new Date().toISOString(),auditPromptAcceptedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),mode:'PROMPT_FIRST_DIRECT',
      requesterConversationId,requesterConversationUrl,requesterSource};
    writeRecord(label,record);
    present(record,{terminalDirective:'YIELD_NOW',yieldCondition:'START_CONFIRMED',mode:'PROMPT_FIRST_DIRECT',bootstrapYielded:false});
    return;
  }
  throw new Error('AUDIT_QUEUE_RETIRED_DIRECT_MODE_REQUIRED');
}
function validateBrief(promptPath){
  if(!promptPath||!fs.existsSync(promptPath))throw new Error('AUDIT_PROMPT_FILE_REQUIRED');
  const sourcePrompt=canonical(fs.readFileSync(promptPath,'utf8').replace(/^\uFEFF/,''));
  if(sourcePrompt.length<200)throw new Error('AUDIT_PROMPT_TOO_SHORT');
  const candidate=candidateFromPrompt(sourcePrompt),reviewKind=reviewKindFromPrompt(sourcePrompt),repository=repositoryFromPrompt(sourcePrompt),prNumber=prNumberFromPrompt(sourcePrompt);
  const reviewExperiment=parseReviewChainShortPrompt(sourcePrompt);
  if(!reviewExperiment)assertIndieAdjacentBrief(sourcePrompt,reviewKind);
  assertDeepExhaustiveBrief(sourcePrompt,reviewKind);
  const riskSweepFamilies=reviewExperiment?[]:riskSweepFamiliesFromPrompt(sourcePrompt,reviewKind);
  console.log(JSON.stringify({ok:true,reviewKind,candidate,repository,prNumber,riskSweepFamilies,reviewExperiment:reviewExperiment?.experiment??null,reviewExperimentKey:reviewExperiment?.key??null,hostJiraKey:reviewExperiment?.host??null,ruleB:reviewExperiment?'EXPERIMENT_PAP_507':reviewKind==='INDIE'?'PAP-454':'N/A',promptSha256:sha(sourcePrompt)},null,2));
}
function fallbackCheck(promptPath){
  if(!promptPath||!fs.existsSync(promptPath))throw new Error('AUDIT_PROMPT_FILE_REQUIRED');
  const sourcePrompt=canonical(fs.readFileSync(promptPath,'utf8').replace(/^\uFEFF/,''));
  const candidate=candidateFromPrompt(sourcePrompt),reviewKind=reviewKindFromPrompt(sourcePrompt),repository=repositoryFromPrompt(sourcePrompt);
  const checked=assertCodexFallbackEligible({reviewKind,candidate,repository});
  console.log(JSON.stringify({ok:true,reviewKind,candidate,repository,receiptPath:checked.path,receiptSha256:checked.sha256,profilesAttempted:checked.receipt.profilesAttempted,exitClass:checked.receipt.exitClass},null,2));
}
function startState(labelRaw){
  const label=safeLabel(labelRaw),record=readRecord(label);
  if(!record)throw new Error('AUDIT_REVIEW_NOT_FOUND:'+label);
  let effective=record;
  const canonicalLabel=record.canonicalLabel??label,canonicalReviewKey=record.canonicalReviewKey??record.reviewKey??null;
  if(canonicalLabel!==label){
    const canonical=readRecord(canonicalLabel);
    if(canonical&&(!canonicalReviewKey||canonical.reviewKey===canonicalReviewKey))effective=canonical;
  }
  const confirmed=effective.state==='CONFIRMED'||effective.state==='TERMINAL'||effective.outcome==='CONFIRMED';
  console.log(JSON.stringify({ok:true,label,state:effective.state,outcome:effective.outcome??null,auditJobId:record.auditJobId??effective.auditJobId??null,reviewKey:record.reviewKey??null,canonicalLabel,canonicalReviewKey,conversationId:effective.conversationId??null,nextEligibleAt:effective.nextEligibleAt??record.nextEligibleAt??null,terminalDirective:confirmed?'YIELD_NOW':'CONTINUE_UNTIL_START_CONFIRMED',yieldCondition:'START_CONFIRMED'},null,2));
}
async function statusAudit(labelRaw){
  const label=safeLabel(labelRaw),record=readRecord(label);
  if(!record)throw new Error('AUDIT_REVIEW_NOT_FOUND:'+label);
  const conversationId=record.conversationId??record.uncertainConversationId??record.failure?.evidence?.conversationId??null;
  if(!conversationId)throw new Error('AUDIT_CONVERSATION_NOT_CONFIRMED:'+label);
  const result=await submitIntent({action:'chatgpt.audit.status',target:{project:'Audit',reviewKey:record.reviewKey},payload:{label,conversationId,candidate:record.candidate,promptSha256:record.promptSha256,reviewKey:record.reviewKey,preferredTargetId:record.targetId??null},priority:3,maxRetries:0,idempotencyKey:`chatgpt-audit/status/${record.reviewKey}/${crypto.randomUUID()}`},120000);
  let next={...record,lastStatusActionId:result.actionId,lastStatusAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
  if(result.outcome!=='CONFIRMED'){next={...next,lastStatusOutcome:result.outcome,lastStatusFailure:result.evidence};writeRecord(label,next);present(next,{statusOutcome:result.outcome});process.exitCode=2;return}
  const e=result.evidence;
  if(e.conversationId!==conversationId||e.candidate!==record.candidate||e.promptSha256!==record.promptSha256)throw new Error('AUDIT_STATUS_RECEIPT_BINDING_INVALID');
  next={...next,lastStatusOutcome:'CONFIRMED',busy:e.busy===true,terminal:e.terminal===true,terminalReason:e.terminalReason??null,conversationId,url:e.url??record.url??record.uncertainUrl??null,targetId:e.targetId??record.targetId??null,lastRecoveredFromTargetId:e.recoveredFromTargetId??null,lastStaleTargetClosed:e.staleTargetClosed??null};
  if(record.state==='OUTCOME_UNKNOWN'&&record.actionId){
    await request('/v1/actions/'+encodeURIComponent(record.actionId)+'/reconcile',{method:'POST',body:{outcome:'CONFIRMED',evidence:{reason:'AUDIT_EXACT_CONVERSATION_AND_PROMPT_HASH_VERIFIED',at:new Date().toISOString(),conversationId}}});
    next={...next,outcome:'CONFIRMED',state:'CONFIRMED',uncertainReconciledAt:new Date().toISOString()};
  }
  if(e.terminal===true&&e.auditResult){validateIndieCoverage(e.auditResult,record.indieAdjacentV1===true);validateIndieFullAxisCoverage(e.auditResult,record.indieFullAxisV1===true);validateReviewChainShortResult(e.auditResult,record.reviewExperiment==='REVIEW_CHAIN_SHORT_V1');validateDeepCoverage(e.auditResult,record.deepExhaustiveV1===true);let sourceFields={};if(record.riskContractHash&&record.reviewObligationKey){const src=verifyChatgptSource(record,e.auditResult,{actionId:result.actionId,receiptId:result.receiptId,evidenceHash:result.receiptEvidenceSha256});sourceFields={terminalStatusActionId:result.actionId,terminalStatusReceiptId:result.receiptId,terminalStatusEvidenceSha256:result.receiptEvidenceSha256,terminalSourceReceiptSha256:src.sourceReceiptSha256}}next={...next,...sourceFields,outcome:'CONFIRMED',state:'TERMINAL',auditResult:e.auditResult,verdict:e.auditResult.verdict,terminalAt:new Date().toISOString()}}
  writeRecord(label,next);present(next,{busy:e.busy===true,terminal:e.terminal===true,terminalReason:e.terminalReason??null,auditResult:e.auditResult??null,url:e.url??next.url??null});
}
async function recoverAuditRefresh(labelRaw,stageRaw='r1'){
  const label=safeLabel(labelRaw),record=readRecord(label);
  if(!record?.conversationId)throw new Error('AUDIT_RECOVERY_CONVERSATION_NOT_CONFIRMED:'+label);
  const stage=String(stageRaw??'r1').toLowerCase();
  if(!['r1','r3'].includes(stage))throw new Error('AUDIT_REFRESH_STAGE_INVALID');
  const prefix=stage==='r1'?'recoveryR1':'recoveryR3';
  if(record[prefix+'At']){present(record,{recovery:stage.toUpperCase()+'_REFRESH',recoveryOutcome:record[prefix+'Outcome']??'ALREADY_ATTEMPTED',idempotent:true});return}
  const key=`chatgpt-audit/refresh/${record.reviewKey}/${stage}`;
  const result=await submitIntent({action:'chatgpt.audit.refresh',target:{project:'Audit',reviewKey:record.reviewKey},payload:{label,conversationId:record.conversationId,stage},priority:4,maxRetries:0,idempotencyKey:key},120000);
  const now=new Date().toISOString();
  const next={...record,[prefix+'At']:now,[prefix+'ActionId']:result.actionId,[prefix+'Outcome']:result.outcome,updatedAt:now};
  writeRecord(label,next);
  if(result.outcome!=='CONFIRMED'){present(next,{recovery:stage.toUpperCase()+'_REFRESH',recoveryOutcome:result.outcome});process.exitCode=2;return}
  present(next,{recovery:stage.toUpperCase()+'_REFRESH',recoveryOutcome:'CONFIRMED',targetId:result.evidence?.targetId??null,reopened:result.evidence?.reopened===true});
}
async function recoverAuditNudge(labelRaw){
  const label=safeLabel(labelRaw),record=readRecord(label);
  if(!record?.conversationId)throw new Error('AUDIT_RECOVERY_CONVERSATION_NOT_CONFIRMED:'+label);
  present(record,{recovery:'R2_STATUS_NUDGE_RETIRED',recoveryOutcome:'NO_WRITE',writeAttempted:false,reason:'AUDIT_STATUS_NUDGE_RETIRED_USE_STATUS_OR_REFRESH'});
}
const readJson=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
function writeJsonAtomic(p,value){
  fs.mkdirSync(path.dirname(p),{recursive:true});
  const tmp=p+'.tmp-'+process.pid+'-'+crypto.randomUUID();
  fs.writeFileSync(tmp,JSON.stringify(value,null,2)+'\n');fs.renameSync(tmp,p);
}
function writeImmutableJson(p,value){
  fs.mkdirSync(path.dirname(p),{recursive:true});
  try{fs.writeFileSync(p,JSON.stringify(value,null,2)+'\n',{flag:'wx'});}
  catch(e){
    if(e.code!=='EEXIST')throw e;
    const existing=readJson(p);
    if(stable(existing)!==stable(value))throw new Error('AUDIT_RESULT_ARTIFACT_CONFLICT');
  }
}
function promoteDirectInbox(record){
  const inbox=directInboxPath(record),rp=resultPath(record);
  if(!fs.existsSync(inbox))return null;
  const payload=validateDirectPublishedFile(record,readJson(inbox));
  const core={schemaVersion:1,kind:'PINO_CHATGPT_AUDITOR_PUBLISHED_RESULT',label:record.label,reviewKind:record.reviewKind,repository:record.repository,prNumber:record.prNumber,projectId:record.projectId,reviewKey:record.reviewKey,candidate:record.candidate,promptSha256:record.promptSha256,sourcePromptSha256:record.sourcePromptSha256??record.promptSha256,conversationId:record.conversationId??null,verdict:payload.verdict,p0:payload.p0,p1:payload.p1,blocking_findings:payload.blocking_findings,summary:payload.summary,publishedAt:payload.publishedAt,publisher:'AUDIT_CONVERSATION_INBOX'};
  const artifact={...core,evidenceHash:crypto.createHash('sha256').update(stable(core)).digest('hex')};
  writeImmutableJson(rp,artifact);
  return artifact;
}
async function closeAuditInternal(labelRaw){
  const label=safeLabel(labelRaw),record=readRecord(label);
  if(!record?.conversationId)throw new Error('AUDIT_CLOSE_REVIEW_NOT_CONFIRMED');
  let evidenceHash=null;
  if(record.publicationAuthority==='AUDIT_CHAT_V1'){
    if(record.state!=='TERMINAL'||!record.auditResult)throw new Error('AUDIT_CLOSE_TERMINAL_RESULT_REQUIRED');
    const core={reviewKey:record.reviewKey,label:record.label,reviewKind:record.reviewKind,repository:record.repository,prNumber:record.prNumber,candidate:record.candidate,conversationId:record.conversationId,result:record.auditResult};
    evidenceHash=crypto.createHash('sha256').update(stable(core)).digest('hex');
  }else{
    if(!['CHATGPT_TERMINAL_V1','AUDITOR_PUBLISHED_V1'].includes(record.publicationAuthority))throw new Error('AUDIT_CLOSE_LEGACY_REVIEW_NOT_CANONICAL');
    const rp=resultPath(record);if(!fs.existsSync(rp))throw new Error('AUDIT_CLOSE_RESULT_ARTIFACT_REQUIRED');
    evidenceHash=verifyResultArtifact(readJson(rp)).evidenceHash;
  }
  const result=await submitIntent({action:'chatgpt.audit.close',target:{project:'Audit',reviewKey:record.reviewKey},payload:{conversationId:record.conversationId},priority:2,maxRetries:0,idempotencyKey:`chatgpt-audit/close/${record.reviewKey}/${evidenceHash}`},120000);
  if(result.outcome!=='CONFIRMED')throw new Error('AUDIT_CLOSE_NOT_CONFIRMED:'+result.outcome);
  const e=result.evidence;
  if(e.conversationId!==record.conversationId||e.remainingCount!==0)throw new Error('AUDIT_CLOSE_RECEIPT_INVALID');
  const now=new Date().toISOString();
  writeRecord(label,{...record,finalizerState:'COMPLETE',tabClosed:true,tabClosedAt:now,closeActionId:result.actionId,closedCount:e.closedCount??0,closedTargetIds:e.closedTargetIds??[],updatedAt:now});
  console.log(JSON.stringify({ok:true,label,conversationId:record.conversationId,closedCount:e.closedCount??0,remainingCount:0,evidenceHash},null,2));
}
function candidateVectorBindingFromEnv(repository,prNumber,candidate){
  const raw=String(process.env.PINO_REVIEW_CANDIDATE_VECTOR_JSON??'').trim();
  if(!raw)return {candidateVector:null,candidateVectorHash:null};
  let rows;try{rows=JSON.parse(raw)}catch(error){throw new Error('REVIEW_CANDIDATE_VECTOR_JSON_INVALID:'+error.message)}
  if(!Array.isArray(rows)||!rows.length)throw new Error('REVIEW_CANDIDATE_VECTOR_EMPTY');
  const normalized=rows.map(row=>({repository:String(row.repository??row.repo??'').trim().toLowerCase(),prNumber:Number(row.prNumber??row.pr),candidate:String(row.candidate??row.headSha??'').trim().toLowerCase()}))
    .sort((a,b)=>`${a.repository}#${a.prNumber}`.localeCompare(`${b.repository}#${b.prNumber}`));
  if(normalized.some(row=>row.repository.split('/').length!==2||!Number.isInteger(row.prNumber)||row.prNumber<1||!/^[0-9a-f]{40}$/.test(row.candidate)))throw new Error('REVIEW_CANDIDATE_VECTOR_BINDING_INVALID');
  if(!normalized.some(row=>row.repository===String(repository).toLowerCase()&&row.prNumber===Number(prNumber)&&row.candidate===String(candidate).toLowerCase()))throw new Error('REVIEW_CANDIDATE_VECTOR_PRIMARY_MISSING');
  return {candidateVector:normalized,candidateVectorHash:crypto.createHash('sha256').update(stable(normalized)).digest('hex')};
}
function assertFreshReviewRequired({reviewKind,repository,prNumber,candidate,riskSweepFamilies=[],candidateVector=null}){
  const fallback=assertCodexFallbackEligible({reviewKind,candidate,repository});
  const required=[...fallback.receipt.requiredRiskFamilies].map(String).sort(),declared=[...riskSweepFamilies].map(String).sort();
  if(stable(required)!==stable(declared))throw new Error('AUDIT_FALLBACK_RISK_CONTRACT_MISMATCH');
  if(!fs.existsSync(REVIEW_REUSE_HELPER))throw new Error('AUDIT_REVIEW_REUSE_HELPER_MISSING');
  const args=[REVIEW_REUSE_HELPER,'check','--repository',repository,'--pr',String(prNumber),'--candidate',candidate,'--dir',REVIEW_AUTHORITY_DIR,'--risk',required.join(','),'--risk-hash',fallback.receipt.riskContractHash];
  if(candidateVector?.length)args.push('--vector-json',JSON.stringify(candidateVector));
  const x=spawnSync(process.execPath,args,{encoding:'utf8',windowsHide:true,maxBuffer:2*1024*1024});
  const detail=(x.stdout||x.stderr||'').trim();
  if(x.status===10)return fallback;
  if(x.status===0)throw new Error('AUDIT_REUSE_VALID_FRESH_REVIEW_FORBIDDEN:'+detail);
  if(x.status===11)throw new Error('AUDIT_PRIOR_REVIEW_BLOCKING:'+detail);
  throw new Error('AUDIT_REVIEW_AUTHORITY_FAIL_CLOSED:'+detail);
}
function materializeReviewerEvidence(core){
  const h=crypto.createHash('sha256').update(stable(core)).digest('hex');fs.mkdirSync(REVIEW_EVIDENCE_DIR,{recursive:true});const file=h+'.json',target=path.join(REVIEW_EVIDENCE_DIR,file),body=JSON.stringify(core,null,2)+'\n';
  try{fs.writeFileSync(target,body,{flag:'wx'});}catch(error){if(error?.code!=='EEXIST')throw error;const existing=readJson(target);if(crypto.createHash('sha256').update(stable(existing)).digest('hex')!==h)throw new Error('REVIEW_EVIDENCE_CONTENT_ADDRESS_COLLISION');}
  return {hash:h,file};
}
function acquireAuthorityLock(key){
  fs.mkdirSync(REVIEW_AUTHORITY_LOCK_DIR,{recursive:true});const lock=path.join(REVIEW_AUTHORITY_LOCK_DIR,key+'.lock'),deadline=Date.now()+15000,token=crypto.randomBytes(24).toString('hex');
  while(true){try{const fd=fs.openSync(lock,'wx');fs.writeFileSync(fd,JSON.stringify({token,pid:process.pid,createdAt:Date.now()})+'\n');fs.closeSync(fd);return {lock,token};}catch(error){if(error?.code!=='EEXIST')throw error;if(Date.now()>deadline)throw new Error('REVIEW_AUTHORITY_LOCK_TIMEOUT_FAIL_CLOSED:'+lock);Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,50);}}
}
function authorityLockOwned(lock,token){try{return readJson(lock).token===token}catch{return false}}
function releaseAuthorityLock(lock,token){if(authorityLockOwned(lock,token)){try{fs.unlinkSync(lock)}catch{}}}
function writeReviewAuthorityLegacy(record,result,source,reviewerEvidenceSha256){
  const repository=String(record.repository??'').trim().toLowerCase();
  const candidate=String(record.candidate??'').trim().toLowerCase();
  if(repository.split('/').length!==2||!/^[0-9a-f]{40}$/.test(candidate)||!Number.isInteger(record.prNumber)||record.prNumber<1)throw new Error('REVIEW_AUTHORITY_BINDING_INVALID');
  if(!['INDIE','DEEP_CONTRACT'].includes(record.reviewKind)||!['PASS','FINDINGS','HOLD'].includes(result.verdict))throw new Error('REVIEW_AUTHORITY_RESULT_INVALID');
  const key=crypto.createHash('sha256').update(repository+'\0'+record.prNumber+'\0'+candidate).digest('hex');
  const verifiedAt=record.terminalAt??record.directPublishedAt??new Date().toISOString();
  const experimentFields=record.reviewExperiment?{reviewExperiment:record.reviewExperiment,reviewExperimentKey:record.reviewExperimentKey,hostJiraKey:record.hostJiraKey,reviewPurpose:record.reviewPurpose,originalCodexAuthorityPath:record.originalCodexAuthorityPath,originalCodexEvidenceHash:record.originalCodexEvidenceHash,originalCodexCandidate:record.originalCodexCandidate,remediationFindingsChecked:result.remediation_findings_checked??[],remediationSurfacesChecked:result.remediation_surfaces_checked??[],outOfScopeFindings:result.out_of_scope_findings??[]}:{};
  const core={schemaVersion:1,kind:'PINO_REVIEW_AUTHORITY',source,repository,prNumber:record.prNumber,reviewKind:record.reviewKind,candidate,verdict:result.verdict,p0:result.p0,p1:result.p1,blockingFindings:result.blocking_findings??[],axisResults:result.axis_results??{},remainingAxes:result.remaining_axes??[],riskFamiliesSwept:result.risk_families_swept??[],unsweptRiskFamilies:result.unswept_risk_families??[],reviewerEvidenceSha256,verifiedAt,...experimentFields};
  const receipt={...core,evidenceHash:crypto.createHash('sha256').update(stable(core)).digest('hex')};
  fs.mkdirSync(REVIEW_AUTHORITY_DIR,{recursive:true});
  const target=path.join(REVIEW_AUTHORITY_DIR,key+'.json');
  if(fs.existsSync(target)){
    try{const existing=readJson(target);if(Date.parse(existing.verifiedAt??'')>Date.parse(verifiedAt))return target}catch{}
  }
  const body=JSON.stringify(receipt,null,2)+'\n';
  const tmp=target+'.tmp-'+process.pid+'-'+crypto.randomUUID();
  fs.writeFileSync(tmp,body);
  try{fs.renameSync(tmp,target)}
  catch(error){
    if(!['EPERM','EACCES'].includes(error?.code)){try{fs.unlinkSync(tmp)}catch{};throw error}
    fs.writeFileSync(target,body);
    try{fs.unlinkSync(tmp)}catch{}
  }
  return target;
}
function writeReviewAuthorityV1(record,result,source){
  const repository=String(record.repository??'').trim().toLowerCase(),candidate=String(record.candidate??'').trim().toLowerCase();
  if(repository.split('/').length!==2||!/^[0-9a-f]{40}$/.test(candidate)||!Number.isInteger(record.prNumber)||record.prNumber<1)throw new Error('REVIEW_AUTHORITY_BINDING_INVALID');
  const key=crypto.createHash('sha256').update(repository+'\0'+record.prNumber+'\0'+candidate).digest('hex'),verifiedAt=record.terminalAt??record.directPublishedAt??new Date().toISOString();
  const src=verifyChatgptSource(record,result,{actionId:record.terminalStatusActionId,receiptId:record.terminalStatusReceiptId,evidenceHash:record.terminalStatusEvidenceSha256,expectedHash:record.terminalSourceReceiptSha256});
  const evCore={schemaVersion:1,kind:'PINO_REVIEW_EVIDENCE',source,repository,prNumber:record.prNumber,reviewKind:record.reviewKind,candidate,verdict:result.verdict,p0:result.p0,p1:result.p1,blockingFindings:result.blocking_findings??[],axisResults:result.axis_results??{},remainingAxes:result.remaining_axes??[],riskFamiliesSwept:result.risk_families_swept??[],unsweptRiskFamilies:result.unswept_risk_families??[],requiredRiskFamilies:record.requiredRiskFamilies??[],riskContractHash:record.riskContractHash??'',candidateVectorHash:record.candidateVectorHash??'',sourceReceiptKind:'PAC_ACTION_RECEIPT_V1',sourcePromptArtifactWsl:record.promptArtifactWsl,sourceActionId:record.terminalStatusActionId,sourceReceiptId:record.terminalStatusReceiptId,sourceReceiptEvidenceSha256:record.terminalStatusEvidenceSha256,sourceReceiptSha256:src.sourceReceiptSha256,reviewKey:record.reviewKey,conversationId:record.conversationId,promptSha256:record.promptSha256,result};
  const ev=materializeReviewerEvidence(evCore);
  const core={schemaVersion:1,kind:'PINO_REVIEW_AUTHORITY',source,repository,prNumber:record.prNumber,reviewKind:record.reviewKind,candidate,verdict:result.verdict,p0:result.p0,p1:result.p1,blockingFindings:result.blocking_findings??[],axisResults:result.axis_results??{},remainingAxes:result.remaining_axes??[],riskFamiliesSwept:result.risk_families_swept??[],unsweptRiskFamilies:result.unswept_risk_families??[],requiredRiskFamilies:record.requiredRiskFamilies??[],riskContractHash:record.riskContractHash??'',sourceReceiptKind:'PAC_ACTION_RECEIPT_V1',sourcePromptArtifactWsl:record.promptArtifactWsl,sourceActionId:record.terminalStatusActionId,sourceReceiptId:record.terminalStatusReceiptId,sourceReceiptEvidenceSha256:record.terminalStatusEvidenceSha256,sourceReceiptSha256:src.sourceReceiptSha256,reviewerEvidenceSha256:ev.hash,reviewerEvidenceFile:ev.file,verifiedAt,...(record.candidateVectorHash?{candidateVector:record.candidateVector,candidateVectorHash:record.candidateVectorHash}:{})};
  const receipt={...core,evidenceHash:crypto.createHash('sha256').update(stable(core)).digest('hex')};fs.mkdirSync(REVIEW_AUTHORITY_DIR,{recursive:true});const target=path.join(REVIEW_AUTHORITY_DIR,key+'.json'),guard=acquireAuthorityLock(key),lock=guard.lock,lockToken=guard.token;
  try{
    if(fs.existsSync(target)){const existing=readJson(target),blocking=existing.blockingFindings??existing.blocking_findings;if(existing.verdict==='HOLD'||existing.verdict==='FINDINGS'||Number(existing.p0)>0||Number(existing.p1)>0||(Array.isArray(blocking)&&blocking.length))throw new Error('REVIEW_AUTHORITY_BLOCKING_OVERWRITE_FORBIDDEN:'+target);const nb=result.verdict==='HOLD'||result.verdict==='FINDINGS'||Number(result.p0)>0||Number(result.p1)>0||Boolean(result.blocking_findings?.length);if(!nb&&Date.parse(existing.verifiedAt??'')>Date.parse(verifiedAt))return target;}
    const tmp=target+'.tmp-'+process.pid+'-'+crypto.randomUUID();fs.writeFileSync(tmp,JSON.stringify(receipt,null,2)+'\n');if(!authorityLockOwned(lock,lockToken))throw new Error('REVIEW_AUTHORITY_FENCE_LOST_BEFORE_RENAME');fs.renameSync(tmp,target);markChatgptObligationTerminal(record,result.verdict,receipt.evidenceHash);return target;
  }finally{releaseAuthorityLock(lock,lockToken)}
}
function writeReviewAuthority(record,result,source,reviewerEvidenceSha256){
  if(record.reviewExperiment||!record.riskContractHash||!record.reviewObligationKey)return writeReviewAuthorityLegacy(record,result,source,reviewerEvidenceSha256);
  return writeReviewAuthorityV1(record,result,source);
}
function resultAudit(labelRaw){
  const label=safeLabel(labelRaw),record=readRecord(label);
  if(!record)throw new Error('AUDIT_REVIEW_NOT_FOUND:'+label);
  if(record.publicationAuthority==='AUDIT_CHAT_V1'){
    if(record.state!=='TERMINAL'||!record.auditResult){console.log(JSON.stringify({ok:true,label,state:'PENDING_AUDIT_CHAT',canonicalAuthority:'AUDIT_CHAT_V1',candidate:record.candidate,conversationId:record.conversationId??null},null,2));return}
    validateIndieCoverage(record.auditResult,record.indieAdjacentV1===true);
    validateIndieFullAxisCoverage(record.auditResult,record.indieFullAxisV1===true);
    validateReviewChainShortResult(record.auditResult,record.reviewExperiment==='REVIEW_CHAIN_SHORT_V1');
    validateRiskCoverage(record.auditResult,record.riskSweepFamilies??[]);
    validateDeepCoverage(record.auditResult,record.deepExhaustiveV1===true);
    const core={reviewKey:record.reviewKey,label:record.label,reviewKind:record.reviewKind,repository:record.repository,prNumber:record.prNumber,candidate:record.candidate,conversationId:record.conversationId,result:record.auditResult};
    const evidenceHash=crypto.createHash('sha256').update(stable(core)).digest('hex');
    const reviewAuthorityPath=writeReviewAuthority(record,record.auditResult,'CHATGPT_AUDIT',evidenceHash);
    console.log(JSON.stringify({ok:true,label,state:'READY',canonicalAuthority:'AUDIT_CHAT_V1',policyBound:true,candidate:record.candidate,repository:record.repository,prNumber:record.prNumber,verdict:record.auditResult.verdict,p0:record.auditResult.p0,p1:record.auditResult.p1,blocking_findings:record.auditResult.blocking_findings,adjacent_paths_swept:record.auditResult.adjacent_paths_swept??null,adjacent_critical_paths_unchecked:record.auditResult.adjacent_critical_paths_unchecked??null,axis_results:record.auditResult.axis_results??null,remaining_axes:record.auditResult.remaining_axes??null,risk_families_swept:record.auditResult.risk_families_swept??null,unswept_risk_families:record.auditResult.unswept_risk_families??null,invariant_families_swept:record.auditResult.invariant_families_swept??null,unswept_critical_paths:record.auditResult.unswept_critical_paths??null,summary:record.auditResult.summary,evidenceHash,reviewAuthorityPath,resultArtifact:null,tabClosed:record.tabClosed===true,conversationId:record.conversationId},null,2));return
  }
  const rp=resultPath(record);
  const direct=record.publicationAuthority==='AUDITOR_PUBLISHED_V1';
  const terminal=record.publicationAuthority==='CHATGPT_TERMINAL_V1';
  let artifact=fs.existsSync(rp)?verifyResultArtifact(readJson(rp)):null;
  if(direct&&fs.existsSync(directInboxPath(record))){
    const promoted=promoteDirectInbox(record);
    if(promoted)artifact=verifyResultArtifact(promoted);
  }
  let directArtifact=null;
  if(direct&&artifact){
    if(artifact.kind!=='PINO_CHATGPT_AUDITOR_PUBLISHED_RESULT')throw new Error('AUDIT_DIRECT_RESULT_KIND_INVALID');
    for(const [k,v] of [['label',record.label],['reviewKind',record.reviewKind],['repository',record.repository],['candidate',record.candidate],['reviewKey',record.reviewKey],['projectId',record.projectId]]) if(artifact[k]!==v)throw new Error('AUDIT_DIRECT_RESULT_BINDING_MISMATCH:'+k);
    if(artifact.prNumber!==record.prNumber)throw new Error('AUDIT_DIRECT_RESULT_BINDING_MISMATCH:prNumber');
    if(artifact.sourcePromptSha256!==(record.sourcePromptSha256??record.promptSha256))throw new Error('AUDIT_DIRECT_RESULT_BINDING_MISMATCH:sourcePromptSha256');
    if(artifact.verdict==='PASS'&&(artifact.p0!==0||artifact.p1!==0||artifact.blocking_findings?.length))throw new Error('AUDIT_DIRECT_RESULT_PASS_NOT_CLEAN');
    validateIndieCoverage(artifact,record.indieAdjacentV1===true);
    validateRiskCoverage(artifact,record.riskSweepFamilies??[]);
    validateDeepCoverage(artifact,record.deepExhaustiveV1===true);
    directArtifact=artifact;
    if(record.directPublishedEvidenceHash&&record.directPublishedEvidenceHash!==artifact.evidenceHash)throw new Error('AUDIT_DIRECT_RESULT_CHANGED_AFTER_CONSUMPTION');
    if(!record.directPublishedEvidenceHash)writeRecord(label,{...record,directPublishedEvidenceHash:artifact.evidenceHash,directPublishedAt:artifact.publishedAt,updatedAt:new Date().toISOString()});
  }
  const terminalArtifact=terminal&&artifact?.kind==='PINO_CHATGPT_AUDIT_TERMINAL'?artifact:null;
  const policyBound=direct||terminal;
  const ready=direct?!!directArtifact:!!terminalArtifact&&record.tabClosed===true;
  const pendingState=direct?'PENDING_DIRECT_PUBLISH':(record.finalizerState??(terminalArtifact?'CLEANUP_PENDING':'PENDING'));
  console.log(JSON.stringify({ok:true,label,state:ready?'READY':policyBound?pendingState:'LEGACY_NONCANONICAL',canonicalAuthority:direct?'AUDITOR_PUBLISHED_V1':'CHATGPT_TERMINAL',policyBound,candidate:record.candidate,repository:record.repository??null,prNumber:record.prNumber??null,verdict:directArtifact?.verdict??terminalArtifact?.verdict??record.verdict??null,p0:directArtifact?.p0??terminalArtifact?.p0??record.auditResult?.p0??null,p1:directArtifact?.p1??terminalArtifact?.p1??record.auditResult?.p1??null,evidenceHash:directArtifact?.evidenceHash??terminalArtifact?.evidenceHash??null,resultArtifact:(directArtifact||terminalArtifact)?rp:null,tabClosed:record.tabClosed===true,conversationId:record.conversationId??null},null,2));
}
async function consumeAudit(labelRaw){
  const label=safeLabel(labelRaw);
  await statusAudit(label);
  const record=readRecord(label);
  if(!record)throw new Error('AUDIT_REVIEW_NOT_FOUND:'+label);
  if(record.state!=='TERMINAL'||!record.auditResult)throw new Error('AUDIT_CONSUME_TERMINAL_RESULT_REQUIRED');
  resultAudit(label);
  await closeAuditInternal(label);
  await syncAuditLabel(label);
}

function lookupAudit(identifierRaw){
  const identifier=String(identifierRaw??'').trim();
  if(!identifier)throw new Error('AUDIT_LOOKUP_IDENTIFIER_REQUIRED');
  const rows=[];
  for(const name of fs.readdirSync(STATE_DIR)){
    if(!name.endsWith('.json'))continue;
    try{const record=readJson(path.join(STATE_DIR,name));if(record?.label)rows.push(record)}catch{}
  }
  let record=null;
  if(/^[A-Za-z0-9_.:-]{1,120}$/.test(identifier))record=rows.find(x=>x.label===identifier)??null;
  record??=rows.find(x=>x.reviewKey===identifier||x.canonicalReviewKey===identifier||x.auditJobId===identifier)??null;
  if(!record)throw new Error('AUDIT_LOOKUP_NOT_FOUND:'+identifier);
  const canonicalReviewKey=record.canonicalReviewKey??record.reviewKey;
  const canonicalLabel=record.canonicalLabel??record.label;
  const canonical=rows.find(x=>x.reviewKey===canonicalReviewKey&&x.label===canonicalLabel)
    ??rows.find(x=>x.reviewKey===canonicalReviewKey)
    ??rows.find(x=>x.label===canonicalLabel)
    ??record;
  return resultAudit(canonical.label);
}

const [command,arg1,arg2,arg3,arg4]=process.argv.slice(2);
if(command==='start')await startAudit(arg1,arg2,arg3,arg4);
else if(command==='start-primary')throw new Error('AUDIT_START_PRIMARY_RETIRED_USE_CODEX_FIRST_START');
else if(command==='validate-brief')validateBrief(arg1);
else if(command==='fallback-check')fallbackCheck(arg1);
else if(command==='start-state')startState(arg1);
else if(command==='status')await statusAudit(arg1);
else if(command==='recover-refresh')await recoverAuditRefresh(arg1,arg2);
else if(command==='recover-nudge')await recoverAuditNudge(arg1);
else if(command==='result')resultAudit(arg1);
else if(command==='lookup')lookupAudit(arg1);
else if(command==='consume')await consumeAudit(arg1);
else if(command==='close-internal')await closeAuditInternal(arg1);
else if(command==='finalize'){
  const record=readRecord(safeLabel(arg1));
  if(record?.publicationAuthority==='AUDIT_CHAT_V1'){
    const {spawnSync}=await import('node:child_process');
    const x=spawnSync(process.execPath,['C:/Users/ADMIN/Documents/PINO_SOP/tools/pino-chatgpt-audit-inbox-finalizer.mjs',safeLabel(arg1)],{encoding:'utf8',windowsHide:true,timeout:3*60*60*1000,maxBuffer:1024*1024});
    if(x.status!==0)throw new Error('AUDIT_CHAT_FINALIZER_FAILED:'+(x.stderr||x.stdout||x.error?.message||x.status));
    if(x.stdout)process.stdout.write(x.stdout);
  }else{
    const mod=await import('./pino-chatgpt-audit-finalizer.mjs');await mod.finalizeAudit(arg1);
  }
}
else throw new Error('USAGE: pino-chatgpt-audit start <prompt-file> <label> [requester-conversation-id requester-conversation-url] | validate-brief <prompt-file> | fallback-check <prompt-file> | start-state <label> | finalize <label> | status <label> | recover-refresh <label> | recover-nudge <label> | result <label> | consume <label> | lookup <label|reviewKey|jobId>');
