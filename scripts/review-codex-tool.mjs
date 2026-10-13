#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {inspectReview,markReviewStarted,markReviewNoSideEffect,markReviewTerminal} from './review-tool-state.mjs';

const SELF=fileURLToPath(import.meta.url);
const DEFAULT_STATE='C:/Users/ADMIN/Documents/PINO_SOP/state/review-tools/codex';
const ROOT=()=>path.resolve(process.env.PINO_REVIEW_CODEX_STATE_DIR||DEFAULT_STATE);
const WSL=process.env.PINO_WSL_EXE||'C:/Windows/System32/wsl.exe';
const DISTRO=process.env.PINO_WSL_DISTRO||'Ubuntu-24.04';
const now=()=>new Date().toISOString();
function atomic(p,v){fs.mkdirSync(path.dirname(p),{recursive:true});const t=p+'.tmp-'+process.pid+'-'+crypto.randomUUID();fs.writeFileSync(t,JSON.stringify(v,null,2)+'\n');fs.renameSync(t,p)}
function read(p){return fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'')):null}
function q(s){return `'${String(s).replaceAll("'",`'"'"'`)}'`}
function validateWslWorktree(w){const x=String(w||'').trim();if(!x.startsWith('/home/tri/pino-work/'))throw new Error('REVIEW_CODEX_WSL_WORKTREE_REQUIRED');return x}
function probe(record,w){const script=`cd ${q(w)} && git rev-parse HEAD && git status --porcelain | wc -l && git remote get-url origin`;const x=spawnSync(WSL,['-d',DISTRO,'--','bash','-lc',script],{encoding:'utf8',windowsHide:true,timeout:30000});if(x.error||x.status!==0)throw new Error('REVIEW_CODEX_WORKTREE_PROBE_FAILED:'+(x.stderr||x.stdout||x.error?.message));const [head,dirty,origin]=String(x.stdout).trim().split(/\r?\n/);const repo=String(origin||'').replace(/\.git$/,'').replace(/^git@github\.com:/,'').replace(/^https?:\/\/github\.com\//,'').toLowerCase();if(head.toLowerCase()!==record.binding.candidate)throw new Error('REVIEW_CODEX_HEAD_MISMATCH');if(Number(dirty)!==0)throw new Error('REVIEW_CODEX_WORKTREE_NOT_CLEAN');if(repo!==record.binding.repository)throw new Error('REVIEW_CODEX_REPOSITORY_MISMATCH');return {head,repository:repo,wslWorktree:w}}
function filesFor(r){const base=path.join(ROOT(),r.obligationKey+'-'+r.attemptId);return {snapshot:base+'.snapshot.json',result:base+'.result.json'};}
function pidAlive(pid){try{process.kill(Number(pid),0);return true}catch{return false}}
function parseLaunches(stderr){return String(stderr||'').split(/\r?\n/).filter(x=>x.startsWith('PINO_TOOL_LAUNCH_JSON=')).flatMap(x=>{try{return [JSON.parse(x.slice('PINO_TOOL_LAUNCH_JSON='.length))]}catch{return []}})}
function parseVerified(stdout){const rows=String(stdout||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);for(let i=rows.length-1;i>=0;i--){try{const j=JSON.parse(rows[i]);if(j?.codexDirectReviewVerified===true)return j}catch{}}return null}

export function startCodexReview({key,promptPath,wslWorktree,sessionSlice,projectCode}){
  const record=inspectReview(key);if(record.provider!=='CODEX')throw new Error('REVIEW_CODEX_PROVIDER_NOT_CLAIMED');if(record.state==='START_CONFIRMED'||record.state==='TERMINAL'||record.state==='CONSUMED')return {...record,idempotent:true};if(record.state!=='CLAIMED')throw new Error('REVIEW_CODEX_START_STATE_INVALID:'+record.state);
  const worktree=validateWslWorktree(wslWorktree);probe(record,worktree);if(!fs.existsSync(promptPath))throw new Error('REVIEW_CODEX_PROMPT_REQUIRED');const prompt=fs.readFileSync(promptPath,'utf8').replace(/^\uFEFF/,'');if(prompt.trim().length<200)throw new Error('REVIEW_CODEX_PROMPT_TOO_SHORT');
  const slice=String(sessionSlice||'').trim(),project=String(projectCode||'').trim();if(!slice||!project)throw new Error('REVIEW_CODEX_SCOPE_REQUIRED');const f=filesFor(record);const snapshot={schemaVersion:1,obligationKey:key,attemptId:record.attemptId,binding:record.binding,wslWorktree:worktree,promptPath:path.resolve(promptPath),sessionSlice:slice,projectCode:project,resultPath:f.result,createdAt:now()};atomic(f.snapshot,snapshot);
  const child=spawn(process.execPath,[SELF,'worker',f.snapshot],{detached:true,stdio:'ignore',windowsHide:true});child.unref();return markReviewStarted(key,'CODEX',{provider:'CODEX',workerPid:child.pid,resultPath:f.result,snapshotPath:f.snapshot,wslWorktree:worktree,sessionSlice:slice,projectCode:project});
}

function worker(snapshotPath){const s=read(snapshotPath);if(!s)throw new Error('REVIEW_CODEX_SNAPSHOT_MISSING');const prompt=fs.readFileSync(s.promptPath,'utf8');const envPrefix=`PINO_SESSION_SLICE=${q(s.sessionSlice)} PINO_PROJECT_CODE=${q(s.projectCode)} PINO_REVIEW_REPOSITORY=${q(s.binding.repository)} PINO_REVIEW_PR_NUMBER=${q(String(s.binding.prNumber))}`;const cmd=`cd ${q(s.wslWorktree)} && ${envPrefix} /home/tri/bin/pino-codex-review exec -`;const x=spawnSync(WSL,['-d',DISTRO,'--','bash','-lc',cmd],{input:prompt,encoding:'utf8',windowsHide:true,timeout:6*60*60*1000,maxBuffer:32*1024*1024});atomic(s.resultPath,{schemaVersion:1,finishedAt:now(),status:x.status,signal:x.signal??null,error:x.error?String(x.error.message):null,stdout:String(x.stdout??''),stderr:String(x.stderr??'')});}

export function statusCodexReview({key}){const record=inspectReview(key);if(record.provider!=='CODEX')throw new Error('REVIEW_CODEX_PROVIDER_NOT_CLAIMED');if(record.state==='TERMINAL'||record.state==='CONSUMED'||record.state==='NO_SIDE_EFFECT')return {...record,idempotent:true};if(record.state!=='START_CONFIRMED')throw new Error('REVIEW_CODEX_STATUS_STATE_INVALID:'+record.state);const h=record.handle,r=read(h.resultPath);if(!r)return {ok:true,state:pidAlive(h.workerPid)?'RUNNING':'RESULT_PENDING',workerPid:h.workerPid};const launches=parseLaunches(r.stderr),verified=parseVerified(r.stdout),terminalLaunch=launches.filter(x=>x.state==='TERMINAL').at(-1),noLaunch=launches.find(x=>x.state==='NO_LAUNCH');if(Number(r.status)===88||terminalLaunch?.exit_class==='CAPACITY_EXHAUSTED')return markReviewNoSideEffect(key,'CODEX',{operation:'CODEX_REVIEW',reason:'CAPACITY_EXHAUSTED',status:r.status,terminalLaunch});if(noLaunch)return markReviewNoSideEffect(key,'CODEX',{operation:'CODEX_REVIEW',reason:'NO_LAUNCH',status:r.status,launch:noLaunch});if(Number(r.status)===0&&verified){if(String(verified.repository||'').toLowerCase()!==record.binding.repository||Number(verified.pr_number)!==record.binding.prNumber||String(verified.candidate||'').toLowerCase()!==record.binding.candidate||String(verified.review_kind||'').toUpperCase()!==record.binding.reviewKind)throw new Error('REVIEW_CODEX_RESULT_BINDING_INVALID');return markReviewTerminal(key,'CODEX',{provider:'CODEX',verified});}return markReviewTerminal(key,'CODEX',{provider:'CODEX',errorAfterStart:true,status:r.status,signal:r.signal,error:r.error,terminalLaunch:terminalLaunch??null,stderrTail:String(r.stderr||'').slice(-4000)});}

async function main(){const a=process.argv.slice(2),cmd=a.shift(),v=n=>{const i=a.indexOf(n);if(i<0||i===a.length-1)throw new Error('ARG_REQUIRED:'+n);return a[i+1]};if(cmd==='worker'){worker(vByPosition(a,0));return}let out;if(cmd==='start')out=startCodexReview({key:v('--key'),promptPath:v('--prompt'),wslWorktree:v('--worktree'),sessionSlice:v('--slice'),projectCode:v('--project')});else if(cmd==='status'||cmd==='result')out=statusCodexReview({key:v('--key')});else throw new Error('USAGE: review-codex-tool.mjs start|status|result ...');console.log(JSON.stringify(out,null,2));}
function vByPosition(a,i){if(!a[i])throw new Error('ARG_REQUIRED:position'+i);return a[i]}
if(pathToFileURL(process.argv[1]||'').href===import.meta.url)main().catch(e=>{console.error('ERROR: '+e.message);process.exitCode=1});
