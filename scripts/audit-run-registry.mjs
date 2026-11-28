import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';

const ROOT=process.env.PINO_SOP_ROOT??'C:/Users/ADMIN/Documents/PINO_SOP';
const STATE=path.join(ROOT,'state');
const CODEX_DIR=path.join(STATE,'codex-fallback');
const CHATGPT_DIR=path.join(STATE,'chatgpt-audit');
const AUTH_DIR=path.join(STATE,'review-authority');
const PENDING_DIR=path.join(STATE,'audit-registry-pending');
const REGISTRY_ISSUE=process.env.PINO_AUDIT_REGISTRY_ISSUE??'PAP-447';
const BASE_URL=process.env.PINO_JIRA_BASE_URL??'https://vmtct97.atlassian.net';
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const digest=v=>crypto.createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
const readJson=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const iso=x=>Number.isFinite(Date.parse(x??''))?new Date(x).toISOString():null;
const truncate=(v,n=700)=>{const s=String(v??'').replace(/\s+/g,' ').trim();return s.length>n?s.slice(0,n-1)+'…':s};

function userEnv(name){
  if(process.env[name])return process.env[name];
  if(process.platform!=='win32')return null;
  const r=spawnSync('reg.exe',['query','HKCU\\Environment','/v',name],{encoding:'utf8',windowsHide:true,timeout:5000});
  if(r.error||r.status!==0)return null;
  const line=String(r.stdout??'').split(/\r?\n/).find(x=>x.includes(name)&&x.includes('REG_'));
  const m=line?.match(/REG_(?:SZ|EXPAND_SZ)\s+(.+)$/);return m?m[1].trim():null;
}
function jiraHeaders(){
  const email=userEnv('JIRA_EMAIL'),token=userEnv('JIRA_API_TOKEN');
  if(!email||!token)throw new Error('AUDIT_REGISTRY_JIRA_MACHINE_AUTH_MISSING');
  return {Authorization:'Basic '+Buffer.from(`${email}:${token}`).toString('base64'),Accept:'application/json','Content-Type':'application/json'};
}
async function jira(pathname,options={}){
  const r=await fetch(BASE_URL.replace(/\/$/,'')+pathname,{...options,headers:{...jiraHeaders(),...(options.headers??{})}});
  const text=await r.text();let body=null;try{body=text?JSON.parse(text):null}catch{body={raw:text}};
  if(!r.ok){const e=new Error(`AUDIT_REGISTRY_JIRA_HTTP_${r.status}`);e.body=body;throw e}return body;
}
function adfText(node){if(node==null)return'';if(typeof node==='string')return node;if(Array.isArray(node))return node.map(adfText).join('\n');return (node.text??'')+(node.content?adfText(node.content):'');}
const toAdf=text=>({type:'doc',version:1,content:String(text).split(/\r?\n/).map(line=>({type:'paragraph',content:line?[{type:'text',text:line}]:[]}))});
function canonicalSnapshot(text){const t=String(text??'').trim();const i=t.indexOf('PAP447_RUN_KEY:');return i>=0?t.slice(i).trim():t}
async function existingEntries(){
  const entries=new Map();let startAt=0;
  for(;;){const page=await jira(`/rest/api/3/issue/${encodeURIComponent(REGISTRY_ISSUE)}/comment?startAt=${startAt}&maxResults=100&orderBy=created`);for(const c of page?.comments??[]){const t=adfText(c.body);for(const m of t.matchAll(/PAP447_RUN_KEY:\s*([0-9a-f]{64})/gi))entries.set(m[1].toLowerCase(),{text:t,commentId:c.id??null,created:c.created??null})}startAt+=Number(page?.maxResults??100);if(startAt>=Number(page?.total??0))break;}
  return entries;
}
function listJson(dir){if(!fs.existsSync(dir))return[];return fs.readdirSync(dir).filter(x=>x.endsWith('.json')).map(name=>{const p=path.join(dir,name);try{return {path:p,name,value:readJson(p),mtime:fs.statSync(p).mtimeMs}}catch{return null}}).filter(Boolean)}
function receiptSha(item){return digest(item.value)}
function sameReceipt(record,receiptItem){
  const rp=String(record?.codexFallbackReceiptPath??'').replace(/\\/g,'/').toLowerCase();
  const ep=receiptItem.path.replace(/\\/g,'/').toLowerCase();
  if(rp&&rp===ep)return true;
  return record?.candidate===receiptItem.value?.candidate&&String(record?.repository??'').toLowerCase()===String(receiptItem.value?.repository??'').toLowerCase()&&String(record?.reviewKind??'').toUpperCase()===String(receiptItem.value?.reviewKind??'').toUpperCase();
}
function bestChatgpt(receiptItem,chatItems){
  const rows=chatItems.filter(x=>x.value?.label&&sameReceipt(x.value,receiptItem));if(!rows.length)return {best:null,attempts:[]};
  rows.sort((a,b)=>{const av=a.value,bv=b.value;const ar=(av.state==='TERMINAL'&&av.auditResult?3:av.state==='TERMINAL'?2:av.outcome==='CONFIRMED'?1:0),br=(bv.state==='TERMINAL'&&bv.auditResult?3:bv.state==='TERMINAL'?2:bv.outcome==='CONFIRMED'?1:0);if(ar!==br)return br-ar;return Date.parse(bv.terminalAt??bv.updatedAt??bv.createdAt??0)-Date.parse(av.terminalAt??av.updatedAt??av.createdAt??0)});
  return {best:rows[0],attempts:rows};
}
function bestAuthority(candidate,repo,pr,authItems){
  const rows=authItems.filter(x=>String(x.value?.candidate??'').toLowerCase()===String(candidate??'').toLowerCase()&&String(x.value?.repository??'').toLowerCase()===String(repo??'').toLowerCase()&&(!pr||Number(x.value?.prNumber??x.value?.pr_number??0)===Number(pr)));
  rows.sort((a,b)=>Date.parse(b.value?.verifiedAt??b.value?.createdAt??0)-Date.parse(a.value?.verifiedAt??a.value?.createdAt??0));return rows[0]??null;
}
function inferHost(label){const m=String(label??'').match(/PAP[-_ ]?(\d+)/i);return m?`PAP-${m[1]}`:null}
function buildRun(receiptItem,{chatItems,authItems}){
  const r=receiptItem.value,{best,attempts}=bestChatgpt(receiptItem,chatItems),c=best?.value??null;
  const authority=bestAuthority(r.candidate,r.repository,c?.prNumber,authItems);const a=authority?.value??null;
  const receiptHash=receiptSha(receiptItem);const runKey=digest({kind:'PAP447_AUDIT_RUN_V1',reviewKind:r.reviewKind,repository:String(r.repository??'').toLowerCase(),candidate:String(r.candidate??'').toLowerCase(),codexReceiptSha256:receiptHash});
  const result=c?.auditResult??null;const verdict=a?.verdict??c?.verdict??result?.verdict??null;
  return {schemaVersion:1,kind:'PAP447_AUDIT_RUN',runKey,registryIssue:REGISTRY_ISSUE,jiraHost:inferHost(c?.label),reviewKind:r.reviewKind,repository:r.repository,prNumber:c?.prNumber??null,candidate:r.candidate,codex:{exitClass:r.exitClass??null,allAuthenticatedProfilesExhausted:r.allAuthenticatedProfilesExhausted===true,profilesAttempted:r.profilesAttempted??[],createdAt:iso(r.createdAt),receiptPath:receiptItem.path,receiptSha256:receiptHash,capacityEvidenceReused:r.capacityEvidenceReused===true,codexAttemptedForCandidate:r.codexAttemptedForCandidate===false?false:true,resetAt:r.resetAt??null,routingReason:r.routingReason??null,capacityObservationPath:r.capacityObservationPath??null,capacityObservationHash:r.capacityObservationHash??null,sourceCapacityObservedAt:iso(r.sourceCapacityObservedAt)},chatgpt:c?{label:c.label,state:c.state??null,outcome:c.outcome??null,conversationId:c.conversationId??null,url:c.url??null,reviewKey:c.reviewKey??null,promptSha256:c.promptSha256??null,sourcePromptSha256:c.sourcePromptSha256??null,createdAt:iso(c.createdAt),confirmedAt:iso(c.confirmedAt),terminalAt:iso(c.terminalAt),attemptCount:attempts.length}:null,result:verdict?{verdict,p0:Number(a?.p0??result?.p0??0),p1:Number(a?.p1??result?.p1??0),blockingFindings:a?.blockingFindings??result?.blocking_findings??[],summary:result?.summary??null}:null,authority:authority?{path:authority.path,evidenceHash:a?.evidenceHash??null,reviewerEvidenceSha256:a?.reviewerEvidenceSha256??null,verifiedAt:iso(a?.verifiedAt)}:null,lifecycle:authority?'REVIEW_AUTHORITY_MATERIALIZED':c?.state==='TERMINAL'?'CHATGPT_TERMINAL':c?.state??'CODEX_EXHAUSTED_NO_CHATGPT_MATCH',backfillSource:'LOCAL_EVIDENCE_JOIN_V1'};
}
function renderRun(run){
  const b=run.result?.blockingFindings??[];const lines=[`PAP447_RUN_KEY: ${run.runKey}`,'AUDIT_RUN_REGISTRY_V1',`JIRA_HOST: ${run.jiraHost??'UNKNOWN/HISTORICAL'}`,`REVIEW_KIND: ${run.reviewKind}`,`REPOSITORY: ${run.repository}`,`PR_NUMBER: ${run.prNumber??'UNKNOWN'}`,`CANDIDATE: ${run.candidate}`,`CODEX_OUTCOME: ${run.codex.exitClass??'UNKNOWN'}`,`CODEX_EXHAUSTED_ALL_PROFILES: ${run.codex.allAuthenticatedProfilesExhausted}`,`CODEX_PROFILES: ${(run.codex.profilesAttempted??[]).join(', ')||'UNKNOWN'}`,`CODEX_RECEIPT: ${run.codex.receiptPath}`,`CODEX_RECEIPT_SHA256: ${run.codex.receiptSha256}`,`CODEX_AT: ${run.codex.createdAt??'UNKNOWN'}`,`CODEX_ATTEMPTED_FOR_CANDIDATE: ${run.codex.codexAttemptedForCandidate}`,`CAPACITY_EVIDENCE_REUSED: ${run.codex.capacityEvidenceReused}`,`CAPACITY_RESET_AT: ${run.codex.resetAt??'NONE'}`,`CAPACITY_ROUTING_REASON: ${run.codex.routingReason??'NONE'}`,`CAPACITY_OBSERVATION: ${run.codex.capacityObservationPath??'NONE'}`,`CAPACITY_OBSERVATION_SHA256: ${run.codex.capacityObservationHash??'NONE'}`,`CAPACITY_SOURCE_OBSERVED_AT: ${run.codex.sourceCapacityObservedAt??'NONE'}`,`CHATGPT_LABEL: ${run.chatgpt?.label??'NONE'}`,`CHATGPT_STATE: ${run.chatgpt?.state??'NONE'}`,`CHATGPT_ATTEMPTS_MATCHED: ${run.chatgpt?.attemptCount??0}`,`CHATGPT_CONVERSATION: ${run.chatgpt?.url??'NONE'}`,`REVIEW_KEY: ${run.chatgpt?.reviewKey??'NONE'}`,`PROMPT_SHA256: ${run.chatgpt?.promptSha256??'NONE'}`,`TERMINAL_AT: ${run.chatgpt?.terminalAt??'NONE'}`,`VERDICT: ${run.result?.verdict??'NONE'}`,`P0: ${run.result?.p0??'NONE'}`,`P1: ${run.result?.p1??'NONE'}`,`BLOCKING_FINDINGS_COUNT: ${b.length}`,`BLOCKING_FINDING_1: ${b.length?truncate(typeof b[0]==='string'?b[0]:JSON.stringify(b[0]),900):'NONE'}`,`RESULT_SUMMARY: ${truncate(run.result?.summary,900)||'NONE'}`,`REVIEW_AUTHORITY: ${run.authority?.path??'NONE'}`,`REVIEW_AUTHORITY_EVIDENCE_SHA256: ${run.authority?.evidenceHash??'NONE'}`,`LIFECYCLE: ${run.lifecycle}`,'RAW_EVIDENCE_REMAINS_LOCAL: true'];return lines.join('\n');
}
async function postRun(run,{knownEntries=null}={}){
  const entries=knownEntries??await existingEntries(),body=renderRun(run),existing=entries.get(run.runKey);
  if(existing&&canonicalSnapshot(existing.text)===body.trim())return {ok:true,status:'ALREADY_INDEXED',runKey:run.runKey,commentId:existing.commentId??null};
  const commentBody=existing?`PAP447_RECONCILES_RUN_KEY: ${run.runKey}\nAUDIT_RUN_RECONCILIATION_V1\n${body}`:body;
  const created=await jira(`/rest/api/3/issue/${encodeURIComponent(REGISTRY_ISSUE)}/comment`,{method:'POST',body:JSON.stringify({body:toAdf(commentBody)})});entries.set(run.runKey,{text:commentBody,commentId:created?.id??null,created:new Date().toISOString()});return {ok:true,status:existing?'RECONCILED':'INDEXED',runKey:run.runKey,commentId:created?.id??null};
}
function pendingPath(runKey){return path.join(PENDING_DIR,runKey+'.json')}
function persistPending(run,error){fs.mkdirSync(PENDING_DIR,{recursive:true});fs.writeFileSync(pendingPath(run.runKey),JSON.stringify({run,error:String(error?.message??error),queuedAt:new Date().toISOString()},null,2)+'\n');}
async function syncRun(run,options={}){try{const out=await postRun(run,options);try{fs.unlinkSync(pendingPath(run.runKey))}catch{}return out}catch(error){persistPending(run,error);return {ok:false,status:'PENDING_JIRA_SYNC',runKey:run.runKey,error:error.message}}
}
function inventory(){const receipts=listJson(CODEX_DIR),chatItems=listJson(CHATGPT_DIR),authItems=listJson(AUTH_DIR);return {receipts,chatItems,authItems,runs:receipts.map(x=>buildRun(x,{chatItems,authItems}))}}
export async function syncAuditLabel(label){const inv=inventory();const state=inv.chatItems.find(x=>x.value?.label===label);if(!state)throw new Error('AUDIT_REGISTRY_LABEL_NOT_FOUND');const receipt=inv.receipts.find(x=>sameReceipt(state.value,x));if(!receipt)return {ok:true,status:'NOT_CODEX_FALLBACK',label};const run=buildRun(receipt,inv);return syncRun(run)}
export async function backfill({dryRun=false}={}){const inv=inventory(),entries=await existingEntries();const results=[];for(const run of inv.runs){if(dryRun){const existing=entries.get(run.runKey),same=!!existing&&canonicalSnapshot(existing.text)===renderRun(run).trim();results.push({runKey:run.runKey,candidate:run.candidate,repo:run.repository,pr:run.prNumber,lifecycle:run.lifecycle,verdict:run.result?.verdict??null,chatgptLabel:run.chatgpt?.label??null,alreadyIndexed:same,needsReconciliation:!!existing&&!same});continue}results.push(await syncRun(run,{knownEntries:entries}))}return {ok:results.every(x=>x.ok!==false),registryIssue:REGISTRY_ISSUE,receiptCount:inv.receipts.length,chatgptArtifactCount:inv.chatItems.length,authorityArtifactCount:inv.authItems.length,indexed:results.filter(x=>x.status==='INDEXED').length,reconciled:results.filter(x=>x.status==='RECONCILED').length,alreadyIndexed:results.filter(x=>x.status==='ALREADY_INDEXED').length,pending:results.filter(x=>x.status==='PENDING_JIRA_SYNC').length,results};}
export async function flushPending(){if(!fs.existsSync(PENDING_DIR))return {ok:true,flushed:0,pending:0};const files=listJson(PENDING_DIR),entries=await existingEntries(),results=[];for(const f of files){if(!f.value?.run)continue;results.push(await syncRun(f.value.run,{knownEntries:entries}))}return {ok:results.every(x=>x.ok!==false),flushed:results.filter(x=>x.ok).length,pending:results.filter(x=>!x.ok).length,results};}

const [cmd,arg]=process.argv.slice(2);
if(process.argv[1]&&path.basename(process.argv[1]).toLowerCase()==='audit-run-registry.mjs'){
  try{let out;if(cmd==='backfill')out=await backfill({dryRun:arg==='--dry-run'});else if(cmd==='sync-label')out=await syncAuditLabel(arg);else if(cmd==='flush-pending')out=await flushPending();else if(cmd==='inventory'){const inv=inventory();out={receipts:inv.receipts.length,chatgptArtifacts:inv.chatItems.length,authorityArtifacts:inv.authItems.length,runs:inv.runs};}else throw new Error('USAGE: audit-run-registry.mjs backfill [--dry-run] | sync-label <audit-label> | flush-pending | inventory');console.log(JSON.stringify(out,null,2));if(out?.ok===false)process.exitCode=2;}catch(error){console.error(JSON.stringify({ok:false,error:error.message,detail:error.body??null},null,2));process.exitCode=1;}
}
