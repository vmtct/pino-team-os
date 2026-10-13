import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT=process.env.PINO_SOP_ROOT??'C:/Users/ADMIN/Documents/PINO_SOP';
const CONFIG=path.join(ROOT,'state/experiments/review-chain-short-v1.json');
const canonical=s=>String(s??'').replace(/\r\n/g,'\n').replace(/\r/g,'\n').trim();
const field=(prompt,name)=>canonical(prompt).split('\n').map(x=>x.match(new RegExp('^'+name+'\\s*:\\s*(.+?)\\s*$','i'))).find(Boolean)?.[1]?.trim()??null;
const stable=v=>Array.isArray(v)?'['+v.map(stable).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}':JSON.stringify(v);
export const digest=v=>crypto.createHash('sha256').update(typeof v==='string'?v:stable(v)).digest('hex');
const readJson=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
function fail(code,detail=''){const e=new Error(detail?code+':'+detail:code);e.code=code;throw e;}

export function loadReviewChainShortConfig(){
  if(!fs.existsSync(CONFIG))fail('REVIEW_CHAIN_SHORT_CONFIG_MISSING');
  const c=readJson(CONFIG);
  if(c?.schemaVersion!==1||c?.kind!=='PINO_REVIEW_EXPERIMENT_CONFIG'||c?.experiment!=='REVIEW_CHAIN_SHORT_V1'||c?.jiraKey!=='PAP-507'||c?.active!==true||!Array.isArray(c.allowedHosts))fail('REVIEW_CHAIN_SHORT_CONFIG_INVALID');
  if(Number(c.maxCodexSubstantiveRunsPerChain)!==1||Number(c.maxChatgptRemediationAuditsPerChain)!==1||Number(c.maxIndependentReviewsPerChain)!==2)fail('REVIEW_CHAIN_SHORT_BUDGET_INVALID');
  return c;
}

export function validateReviewChainShortActivation({key,host,at=Date.now()}){
  const c=loadReviewChainShortConfig();
  if(key!==c.jiraKey)fail('REVIEW_CHAIN_SHORT_JIRA_KEY_INVALID',String(key));
  const effectiveAt=Date.parse(c.effectiveFrom??'');
  if(c.globalDefault===true&&(!Number.isFinite(effectiveAt)||Number(at)<effectiveAt))fail('REVIEW_CHAIN_SHORT_NOT_EFFECTIVE_YET',String(c.effectiveFrom??''));
  if(!c.allowedHosts.includes('*')&&!c.allowedHosts.includes(host))fail('REVIEW_CHAIN_SHORT_HOST_NOT_ALLOWLISTED',String(host));
  return c;
}

export function reviewChainShortGlobalDefault({host,at=Date.now()}={}){
  const c=loadReviewChainShortConfig();
  if(c.globalDefault!==true)return null;
  return validateReviewChainShortActivation({key:c.jiraKey,host,at});
}

export function validateOriginalCodexAuthority({authorityPath,authorityHash,originalCandidate,repository=null,prNumber=null}){
  if(!authorityPath||!path.isAbsolute(authorityPath)||!fs.existsSync(authorityPath))fail('REVIEW_CHAIN_SHORT_CODEX_AUTHORITY_MISSING');
  const authority=readJson(authorityPath);
  if(authority?.kind!=='PINO_REVIEW_AUTHORITY'||authority?.source!=='CODEX_DIRECT'||authority?.reviewKind!=='INDIE'||authority?.candidate!==originalCandidate||authority?.verdict==='PASS'||(Number(authority?.p0||0)===0&&Number(authority?.p1||0)===0))fail('REVIEW_CHAIN_SHORT_CODEX_AUTHORITY_INVALID');
  if(!/^[0-9a-f]{64}$/i.test(String(authorityHash))||authority.evidenceHash!==authorityHash)fail('REVIEW_CHAIN_SHORT_CODEX_AUTHORITY_HASH_MISMATCH');
  if(repository&&String(authority.repository).toLowerCase()!==String(repository).toLowerCase())fail('REVIEW_CHAIN_SHORT_CODEX_REPOSITORY_MISMATCH');
  if(prNumber&&Number(authority.prNumber)!==Number(prNumber))fail('REVIEW_CHAIN_SHORT_CODEX_PR_MISMATCH');
  return authority;
}

export function parseReviewChainShortPrompt(prompt){
  const experiment=field(prompt,'REVIEW_EXPERIMENT');
  if(!experiment)return null;
  if(experiment!=='REVIEW_CHAIN_SHORT_V1')fail('REVIEW_CHAIN_SHORT_EXPERIMENT_INVALID',experiment);
  const key=field(prompt,'REVIEW_EXPERIMENT_KEY'),host=field(prompt,'HOST_JIRA_KEY'),purpose=field(prompt,'REVIEW_PURPOSE');
  validateReviewChainShortActivation({key,host});
  if(purpose!=='POST_CODEX_REMEDIATION_VERIFY')fail('REVIEW_CHAIN_SHORT_PURPOSE_INVALID',String(purpose));
  const candidate=field(prompt,'CANDIDATE'),rejected=field(prompt,'REJECTED_CANDIDATE'),original=field(prompt,'ORIGINAL_CODEX_CANDIDATE');
  if(!/^[0-9a-f]{40}$/i.test(String(candidate))||!/^[0-9a-f]{40}$/i.test(String(rejected))||!/^[0-9a-f]{40}$/i.test(String(original)))fail('REVIEW_CHAIN_SHORT_CANDIDATE_INVALID');
  if(candidate===rejected)fail('REVIEW_CHAIN_SHORT_REMEDIATION_HEAD_UNCHANGED');
  const authorityPath=field(prompt,'ORIGINAL_CODEX_AUTHORITY'),authorityHash=field(prompt,'ORIGINAL_CODEX_EVIDENCE_HASH');
  const authority=validateOriginalCodexAuthority({authorityPath,authorityHash,originalCandidate:original,repository:field(prompt,'REPOSITORY'),prNumber:Number(field(prompt,'PR_NUMBER'))});
  const required=['PRIOR_BLOCKING_FINDINGS','ROOT_INVARIANT','RISK_FAMILY','REMEDIATED_SURFACES','REGRESSION_CASES','ADJACENT_REMEDIATION_SURFACES','REMEDIATION_DIFF'];
  const missing=required.filter(x=>!field(prompt,x));if(missing.length)fail('REVIEW_CHAIN_SHORT_BRIEF_INCOMPLETE',missing.join(','));
  return {experiment,key,host,purpose,candidate,rejected,original,authorityPath,authorityHash,authority};
}

export function validateReviewChainShortResult(result,enabled=true){
  if(!enabled)return result;
  if(!result||!['PASS','FINDINGS','HOLD'].includes(result.verdict)||!Number.isInteger(result.p0)||!Number.isInteger(result.p1)||!Array.isArray(result.blocking_findings)||typeof result.summary!=='string'||!result.summary.trim())fail('REVIEW_CHAIN_SHORT_RESULT_INVALID');
  if(result.p0>0)fail('REVIEW_CHAIN_SHORT_P0_HUMAN_BOUNDARY');
  if(result.verdict==='PASS'&&(result.p1!==0||result.blocking_findings.length))fail('REVIEW_CHAIN_SHORT_PASS_NOT_CLEAN');
  if(!Array.isArray(result.remediation_findings_checked)||result.remediation_findings_checked.length<1||result.remediation_findings_checked.some(x=>typeof x!=='string'||!x.trim()))fail('REVIEW_CHAIN_SHORT_FINDINGS_CHECKED_REQUIRED');
  if(!Array.isArray(result.remediation_surfaces_checked)||result.remediation_surfaces_checked.length<1||result.remediation_surfaces_checked.some(x=>typeof x!=='string'||!x.trim()))fail('REVIEW_CHAIN_SHORT_SURFACES_CHECKED_REQUIRED');
  if(!Array.isArray(result.out_of_scope_findings)||result.out_of_scope_findings.some(x=>typeof x!=='string'||!x.trim()))fail('REVIEW_CHAIN_SHORT_OUT_OF_SCOPE_INVALID');
  return result;
}

export function reviewChainShortContract({candidate,experiment}){
  return `REVIEW_CHAIN_SHORT_V1 REMEDIATION VERIFY (EXPERIMENTAL / NON-CANONICAL)\nThis is the second and final independent review in the bounded review chain. Verify only the original Codex blocking findings, the remediation diff, and regressions directly created by or reachable from the remediation surface. Do NOT rerun INDIE_FULL_AXIS_SWEEP_V1, rediscover the whole PR, hunt unrelated historical defects, or reopen architecture review.\nExperiment authority: ${experiment.key}; host: ${experiment.host}.\nP0 is a HUMAN_BOUNDARY: if any P0 is observed, return HOLD/FINDINGS with p0>0 and stop experiment terminalization.\nA new P1 is in-scope only when created by or directly reachable from the remediation. Unrelated observations must be listed only in out_of_scope_findings and must not open another review round.\nEnd with exactly one final line and no prose after it:\nAUDIT_RESULT_JSON={"verdict":"PASS|FINDINGS|HOLD","candidate":${JSON.stringify(candidate)},"p0":0,"p1":0,"blocking_findings":[],"remediation_findings_checked":["<original finding checked>"],"remediation_surfaces_checked":["<bounded remediation surface>"],"out_of_scope_findings":[],"summary":"<bounded non-empty summary>"}\nPASS requires p0=0, p1=0 and blocking_findings=[].`;
}

export function experimentConfigPath(){return CONFIG;}
