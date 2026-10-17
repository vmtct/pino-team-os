#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {claimReview,consumeReview,inspectReview,normalizeBinding,obligationKey} from './review-tool-state.mjs';
import {preflightCodexRisk,startCodexReview,statusCodexReview} from './review-codex-internal.mjs';

const WSL=process.env.PINO_WSL_EXE||'C:/Windows/System32/wsl.exe';
const DISTRO=process.env.PINO_WSL_DISTRO||'Ubuntu-24.04';
const SOP=path.resolve(process.env.PINO_SOP_ROOT||'C:/Users/ADMIN/Documents/PINO_SOP');
const BRIEF_ROOT=path.join(SOP,'state','review-tools','briefs');
const REVIEW_KIND='INDIE';
const q=s=>`'${String(s).replaceAll("'",`'"'"'`)}'`;
const slug=s=>String(s).toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-|-$/g,'');
const readJson=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
function exec(cmd,args,{input,env}={}){const x=spawnSync(cmd,args,{encoding:'utf8',windowsHide:true,timeout:120000,maxBuffer:16*1024*1024,input,env:{...process.env,...env}});if(x.error||x.status!==0)throw new Error(`ATOMIC_REVIEW_EXEC_FAILED:${cmd}:${x.status}:${String(x.stderr||x.stdout||x.error?.message).trim()}`);return String(x.stdout||'').trim();}
function wsl(script){return exec(WSL,['-d',DISTRO,'--','bash','-lc',script]);}
function managedWsl(script,{slice,project,workdir}){
  const session=`/home/tri/bin/pino-session`;
  const body=[
    'set -euo pipefail',
    'export PATH=/home/tri/bin:/home/tri/.nvm/versions/node/v24.19.0/bin:/usr/local/bin:/usr/bin:/bin',
    `export PINO_SESSION_SLICE=${q(slice)} PINO_PROJECT_CODE=${q(project)} PINO_SESSION_PID=$$`,
    `cd ${q(workdir)}`,
    `export PINO_SESSION_ID=$(${session} start --pid $$ --kind engineering --slice ${q(slice)} --project ${q(project)} --purpose atomic-review-worktree --cwd ${q(workdir)} --ttl-seconds 900)`,
    `trap '${session} close "$PINO_SESSION_ID" >/dev/null 2>&1 || true' EXIT`,
    script
  ].join('; ');
  return wsl(body);
}
export function canonicalBinding(repository,prNumber,candidate){return normalizeBinding({reviewKind:REVIEW_KIND,repository,prNumber,candidate});}
export function canonicalOutcome(record){
  if(record?.state==='NO_SIDE_EFFECT'){
    if(record.noSideEffectEvidence?.reason==='CAPACITY_EXHAUSTED_VERIFIED')return {outcome:'BLOCKED_EXTERNAL',reason:'CODEX_CAPACITY_EXHAUSTED',key:record.obligationKey};
    throw new Error('ATOMIC_REVIEW_LOCAL_FAILURE:'+(record.noSideEffectEvidence?.reason||'NO_SIDE_EFFECT'));
  }
  if(['CLAIMED','DISPATCH_RESERVED','START_CONFIRMED','RUNNING','RESULT_PENDING'].includes(record?.state))return {outcome:'RUNNING',key:record.obligationKey,state:record.state};
  if(['TERMINAL','CONSUMED'].includes(record?.state)){
    const verdict=String(record.result?.verified?.verdict||record.result?.auditResult?.verdict||'').toUpperCase();
    if(verdict==='PASS')return {outcome:'PASS',key:record.obligationKey,verdict};
    if(['HOLD','FINDINGS'].includes(verdict))return {outcome:'HOLD',key:record.obligationKey,verdict,p0:record.result?.verified?.p0??record.result?.auditResult?.p0,p1:record.result?.verified?.p1??record.result?.auditResult?.p1};
    throw new Error('ATOMIC_REVIEW_TERMINAL_VERDICT_INVALID:'+verdict);
  }
  throw new Error('ATOMIC_REVIEW_STATE_UNSUPPORTED:'+String(record?.state));
}
function prTruth(repository,prNumber){const j=JSON.parse(exec('gh',['pr','view',String(prNumber),'--repo',repository,'--json','headRefOid,baseRefName,title,url']));if(!/^[0-9a-f]{40}$/i.test(j.headRefOid||''))throw new Error('ATOMIC_REVIEW_PR_HEAD_INVALID');return {candidate:j.headRefOid.toLowerCase(),baseRefName:j.baseRefName,title:j.title,url:j.url};}
function repoName(repository){return repository.split('/')[1];}
export function worktreePaths({jiraKey,repository,candidate}){const name=repoName(repository);return {source:`/home/tri/pino-work/${name}`,target:`/home/tri/pino-work/review-${slug(jiraKey)}-${slug(name)}-${candidate.slice(0,7)}`};}
function ensureExactWorktree({jiraKey,repository,candidate,baseRefName,slice,project}){
  const {source,target}=worktreePaths({jiraKey,repository,candidate});
  const remote=wsl(`git -C ${q(source)} remote get-url origin`).replace(/\.git$/,'').replace(/^git@github\.com:/,'').replace(/^https?:\/\/github\.com\//,'').toLowerCase();
  if(remote!==repository.toLowerCase())throw new Error('ATOMIC_REVIEW_SOURCE_REPOSITORY_MISMATCH');
  wsl(`git -C ${q(source)} fetch origin ${q(candidate)} ${q(baseRefName)}`);
  const exists=wsl(`if [ -d ${q(target)}/.git ] || [ -f ${q(target)}/.git ]; then echo yes; else echo no; fi`)==='yes';
  if(!exists)managedWsl(`git -C ${q(source)} worktree add --detach ${q(target)} ${q(candidate)}`,{slice,project,workdir:source});
  const head=wsl(`/usr/bin/git -C ${q(target)} rev-parse HEAD`).toLowerCase();
  const dirty=wsl(`/usr/bin/git -C ${q(target)} status --porcelain`);
  if(head!==candidate||dirty!=='')throw new Error(`ATOMIC_REVIEW_WORKTREE_NOT_EXACT_CLEAN:head=${head}:dirty=${dirty?1:0}`);
  return {source,target};
}
function slicePaths(jiraKey){const name=slug(jiraKey)+'.json';return {ledger:path.join(SOP,'state','slices',name),manifest:path.join(SOP,'state','test-impact',name)};}
function loadSlice(jiraKey){const p=slicePaths(jiraKey).ledger;if(!fs.existsSync(p))throw new Error('ATOMIC_REVIEW_SLICE_LEDGER_MISSING:'+p);return {path:p,value:readJson(p)};}
export function validateSliceLedger(ledger,jiraKey,binding){
  const sliceId=String(jiraKey||'').trim().toUpperCase();
  const candidate=ledger?.candidate||{},ci=ledger?.dev?.exactHeadCi||{};
  const exact=String(ledger?.slice?.id||'').trim().toUpperCase()===sliceId&&String(candidate.repo||'').trim().toLowerCase()===binding.repository&&Number(candidate.pr)===binding.prNumber&&String(candidate.headSha||'').trim().toLowerCase()===binding.candidate;
  if(!exact)throw new Error('ATOMIC_REVIEW_SLICE_BINDING_MISMATCH:'+sliceId);
  if(String(ci.status||'').toUpperCase()!=='SUCCESS'||String(ci.headSha||'').trim().toLowerCase()!==binding.candidate||!ci.runId)throw new Error('ATOMIC_REVIEW_EXACT_HEAD_CI_REQUIRED:'+sliceId);
  return sliceId;
}
function canonicalSlice(jiraKey,binding){const {value:ledger}=loadSlice(jiraKey),sliceId=validateSliceLedger(ledger,jiraKey,binding);return {sliceId,ledger};}
function assertRiskBinding(record,risk){const bound=record?.handle?.riskPreflight;if(bound&&bound.bindingHash!==risk.bindingHash)throw new Error('ATOMIC_REVIEW_RISK_BINDING_STALE');}
function line(v){return String(v??'').replace(/\r?\n/g,' ').replace(/\s+/g,' ').trim();}
function diffFiles(worktree,base,candidate){const out=wsl(`cd ${q(worktree)} && git diff --name-only origin/${q(base)}...${q(candidate)}`);return out.split(/\r?\n/).filter(Boolean);}
export function buildBrief({binding,pr,jiraKey,ledger,risk,files}){
  const rc=ledger?.dev?.reviewCompleteness||{},ci=ledger?.dev?.exactHeadCi||{};
  const adjacent=Array.isArray(rc.adjacentSurfaces)&&rc.adjacentSurfaces.length?rc.adjacentSurfaces:files;
  const families=risk.families.length?risk.families:['GENERAL_CHANGE_RISK'];
  const rows=[
    ['CANDIDATE',binding.candidate],['BASE_OR_DIFF_SCOPE',`origin/${pr.baseRefName}...${binding.candidate}; files=${files.join(', ')||'none'}`],
    ['INTENDED_CHANGE',`${jiraKey}: ${pr.title}`],['RELEVANT_CI_TESTS',`status=${ci.status||'UNKNOWN'} run=${ci.runId||ci.runID||'unknown'}; canonical slice=${jiraKey}`],
    ['REVIEW_CONTEXT','INITIAL'],['ROOT_INVARIANT',rc.rootInvariant||`Preserve existing product, authorization, persistence and runtime invariants while delivering ${jiraKey}.`],
    ['RISK_FAMILY',families.join(',')],['ADJACENT_SURFACES',adjacent.join(', ')||'touched files and direct callers'],
    ['ADJACENT_SWEEP_RESULT',rc.adjacentSweepResult||'Reviewer must independently sweep touched modules, direct callers, sibling paths and negative cases before verdict.'],
    ['SCOPE_REASSESS',rc.scopeReassess||'KEEP_BOUNDED'],['ADJACENT_IMPACT_SCOPE',files.join(', ')||'exact candidate diff and direct dependants'],
    ['NEGATIVE_CASES','stale candidate binding; authorization/role edge cases; replay/idempotency; rollback/recovery; sibling-path regressions']
  ];
  return rows.map(([k,v])=>`${k}: ${line(v)}`).join('\n')+'\n\nPerform an independent PRE-MAIN review. Return only evidence supported by this exact candidate.\n';
}
function writeBrief(key,text){fs.mkdirSync(BRIEF_ROOT,{recursive:true});const p=path.join(BRIEF_ROOT,key+'.md'),tmp=p+'.tmp-'+process.pid;fs.writeFileSync(tmp,text);fs.renameSync(tmp,p);return p;}
function prepare(opts){
  const pr=prTruth(opts.repository,opts.prNumber),binding=canonicalBinding(opts.repository,opts.prNumber,pr.candidate),key=obligationKey(binding);
  const {sliceId,ledger}=canonicalSlice(opts.jiraKey,binding),risk=preflightCodexRisk(sliceId);
  const wt=ensureExactWorktree({jiraKey:sliceId,repository:binding.repository,candidate:binding.candidate,baseRefName:pr.baseRefName,slice:sliceId,project:opts.project});
  const files=diffFiles(wt.target,pr.baseRefName,binding.candidate);
  const briefPath=writeBrief(key,buildBrief({binding,pr,jiraKey:sliceId,ledger,risk,files}));
  return {binding,key,pr,sliceId,worktree:wt.target,briefPath,risk,files};
}
export function prepareAtomicReview(opts){return prepare(opts);}
export function runAtomicReview(opts){
  const p=prepare(opts);
  let claim;try{claim=claimReview(p.binding,'CODEX',{reclaimNoSideEffect:true});}catch(e){throw new Error('ATOMIC_REVIEW_CLAIM_FAILED:'+e.message);}
  const started=startCodexReview({key:p.key,promptPath:p.briefPath,wslWorktree:p.worktree,sessionSlice:p.sliceId,projectCode:opts.project});
  return {...canonicalOutcome(started),candidate:p.binding.candidate,worktree:p.worktree,briefPath:p.briefPath};
}
export function statusAtomicReview(opts){
  const pr=prTruth(opts.repository,opts.prNumber),binding=canonicalBinding(opts.repository,opts.prNumber,pr.candidate),{sliceId}=canonicalSlice(opts.jiraKey,binding),risk=preflightCodexRisk(sliceId);
  const key=obligationKey(binding);let record=inspectReview(key);assertRiskBinding(record,risk);if(record.provider==='CODEX'&&!['NO_SIDE_EFFECT','TERMINAL','CONSUMED'].includes(record.state))record=statusCodexReview({key});assertRiskBinding(record,risk);
  let out=canonicalOutcome(record);if(['PASS','HOLD'].includes(out.outcome)&&record.state==='TERMINAL'){record=consumeReview(key,record.provider);out=canonicalOutcome(record);}
  return {...out,candidate:binding.candidate};
}
function argsOf(argv){const a=[...argv],cmd=a.shift();if(a.includes('--waiver'))throw new Error('ATOMIC_REVIEW_WAIVER_UNSUPPORTED');if(a.includes('--slice'))throw new Error('ATOMIC_REVIEW_SLICE_ARGUMENT_RETIRED');const v=(n,required=true)=>{const i=a.indexOf(n);if(i<0){if(required)throw new Error('ARG_REQUIRED:'+n);return null;}if(i===a.length-1)throw new Error('ARG_REQUIRED:'+n);return a[i+1]};return {cmd,opts:{jiraKey:v('--jira'),repository:v('--repo'),prNumber:Number(v('--pr')),project:v('--project')}};}
async function main(){const {cmd,opts}=argsOf(process.argv.slice(2));let out;if(cmd==='prepare')out=prepareAtomicReview(opts);else if(cmd==='run')out=runAtomicReview(opts);else if(cmd==='status')out=statusAtomicReview(opts);else throw new Error('USAGE: review-run.mjs prepare|run|status --jira PAP-N --repo owner/repo --pr N --project PRJ-X');console.log(JSON.stringify(out,null,2));}
if(pathToFileURL(process.argv[1]||'').href===import.meta.url)main().catch(e=>{console.error('ERROR: '+e.message);process.exitCode=1});
