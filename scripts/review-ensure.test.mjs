import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync,spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parseResetAt} from './review-ensure.mjs';

const TOOL=fileURLToPath(new URL('./review-ensure.mjs',import.meta.url));
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const digest=v=>crypto.createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
const write=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,typeof v==='string'?v:JSON.stringify(v,null,2)+'\n')};
function fixture(name,head='a'.repeat(40)){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'review-ensure-')),ledger=path.join(root,'ledger.json'),prompt=path.join(root,'prompt.txt'),state=path.join(root,'state','review-ensure.json'),spec=path.join(root,'spec.json');
 write(ledger,{schemaVersion:1,revision:1,ownership:{stream:'DEV'},slice:{id:name},candidate:{repo:'vmtct/pino-core',pr:1,headSha:head},dev:{reviewCompleteness:{reviewContext:'INITIAL',rootInvariant:'bounded authority',riskFamily:'REVIEW_GOVERNANCE',adjacentSurfaces:'review callers',adjacentSweepResult:'PASS bounded sweep',scopeReassess:'NOT_REQUIRED'}}});
 write(prompt,`CANDIDATE: ${head}\nBASE_OR_DIFF_SCOPE: test\nINTENDED_CHANGE: test review ensure\nRELEVANT_CI_TESTS: fixture\nREVIEW_CONTEXT: INITIAL\nROOT_INVARIANT: bounded authority\nRISK_FAMILY: REVIEW_GOVERNANCE\nADJACENT_SURFACES: review callers\nADJACENT_SWEEP_RESULT: PASS bounded sweep\nSCOPE_REASSESS: NOT_REQUIRED\nADJACENT_IMPACT_SCOPE: bounded\nNEGATIVE_CASES: stale, duplicate, auth failure\n`);
 write(spec,{workId:name,obligationId:name,ledgerPath:ledger,promptPath:prompt,wslWorktree:'/home/tri/pino-work/fixture',sessionSlice:name,projectCode:'PAP',testSkipWorktree:true,exactHeadCi:{headSha:head,runId:123,status:'SUCCESS',evidenceRef:'fixture:ci'}});
 return{root,ledger,prompt,state,spec,head};
}
function authority(f,verdict='PASS'){
 const core={schemaVersion:1,kind:'PINO_REVIEW_AUTHORITY',source:'CODEX_DIRECT',independent:true,reviewerProfile:'vmtct97',launcher:'/home/tri/bin/pino-codex-review',repository:'vmtct/pino-core',prNumber:1,reviewKind:'INDIE',candidate:f.head,verdict,p0:0,p1:0,blockingFindings:[],riskFamiliesSwept:[],unsweptRiskFamilies:[],reviewerEvidenceSha256:'x',verifiedAt:new Date().toISOString()};
 const a={...core,evidenceHash:digest(core)},p=path.join(f.root,'authority.json');write(p,a);return p;
}
function run(f,env={}){const x=spawnSync(process.execPath,[TOOL,'ensure',f.spec],{encoding:'utf8',env:{...process.env,NODE_ENV:'test',PINO_SOP_ROOT:f.root,PINO_REVIEW_ENSURE_STATE:f.state,...env}});let json=null;try{json=JSON.parse(x.stdout||x.stderr)}catch{}return{x,json}}
function runAsync(f,env={}){return new Promise(resolve=>{const x=spawn(process.execPath,[TOOL,'ensure',f.spec],{env:{...process.env,NODE_ENV:'test',PINO_SOP_ROOT:f.root,PINO_REVIEW_ENSURE_STATE:f.state,...env}});let out='',err='';x.stdout.on('data',d=>out+=d);x.stderr.on('data',d=>err+=d);x.on('close',code=>{let json=null;try{json=JSON.parse(out||err)}catch{}resolve({code,json,out,err})})})}


test('RESET_AT parser normalizes real Codex clock-only quota horizon in Asia/Ho_Chi_Minh',()=>{
 const parsed=parseResetAt("ERROR: You've hit your usage limit. Upgrade to Pro or try again at 6:04 PM.",'2026-10-12T09:35:36.087Z');
 assert.deepEqual(parsed,{resetAtRaw:'6:04 PM',resetAt:'2026-10-12T18:04:00+07:00',timezone:'Asia/Ho_Chi_Minh',timezoneOffsetMinutes:420});
 assert.equal(parseResetAt("ERROR: You've hit your usage limit.",'2026-10-12T09:35:36.087Z'),null);
});

function seedCapacityObservation(f,{minutesAhead=30}={}){
 const observedAt=new Date(Date.now()-5*60*1000).toISOString(),futureLocal=new Date(Date.now()+minutesAhead*60*1000+7*60*60*1000);let h=futureLocal.getUTCHours();const marker=h>=12?'PM':'AM',h12=h%12||12,raw=`${h12}:${String(futureLocal.getUTCMinutes()).padStart(2,'0')} ${marker}`,providerEvidence=`ERROR: You've hit your usage limit. Upgrade to Pro or try again at ${raw}.`,parsed=parseResetAt(providerEvidence,observedAt),sourceCandidate='9'.repeat(40),sourcePath=path.join(f.root,'state','codex-fallback','INDIE-'+sourceCandidate+'.json'),source={schemaVersion:1,kind:'PINO_CODEX_FALLBACK_ELIGIBILITY',reviewKind:'INDIE',candidate:sourceCandidate,repository:'vmtct/pino-core',exitClass:'CAPACITY_EXHAUSTED',allAuthenticatedProfilesExhausted:true,profilesAttempted:['/home/tri/.codex-vmtct97'],createdAt:observedAt,evidenceLog:path.join(f.root,'source-codex.log')};
 write(source.evidenceLog,providerEvidence+'\n');write(sourcePath,source);const observation={schemaVersion:1,kind:'PINO_CODEX_CAPACITY_OBSERVATION',provider:'OPENAI_CODEX',capacityDomain:'openai:vmtct97',profileId:'vmtct97',state:'EXHAUSTED',observedAt,...parsed,profilesAttempted:source.profilesAttempted,allAuthenticatedProfilesExhausted:true,sourceClass:'PROVIDER_USAGE_LIMIT',sourceReceiptPath:sourcePath,sourceReceiptHash:digest(source),sourceCandidate,sourceRepository:'vmtct/pino-core',evidenceLog:source.evidenceLog,evidenceLogSha256:crypto.createHash('sha256').update(fs.readFileSync(source.evidenceLog)).digest('hex'),providerEvidence,providerEvidenceSha256:crypto.createHash('sha256').update(providerEvidence).digest('hex'),persistedAt:new Date().toISOString()};
 const observationPath=path.join(f.root,'state','codex-capacity','vmtct97.json');write(observationPath,observation);return{observation,observationPath,sourcePath};
}

test('fresh INDIE reuses active single-account exhaustion and skips redundant Codex launch',()=>{
 const f=fixture('known-capacity-skip','6'.repeat(40)),seed=seedCapacityObservation(f),cf=path.join(f.root,'codex-should-not-run.json'),start=path.join(f.root,'chat-start.json');
 write(cf,{schemaVersion:1,status:89,stdout:'',stderr:'SHOULD_NOT_RUN'});write(start,{auditWorkId:'review-ensure:known-capacity-skip:666666666666',conversationUrl:'https://chatgpt.com/c/known-capacity',label:'known-capacity-audit',round:1});
 const a=run(f,{PINO_REVIEW_ENSURE_TEST_CODEX_FIXTURE:cf,PINO_REVIEW_ENSURE_TEST_CHATGPT_START_FIXTURE:start});assert.equal(a.x.status,0);assert.equal(a.json.provider,'CHATGPT_AUDIT_FALLBACK');assert.equal(a.json.transition,'KNOWN_CAPACITY_EXHAUSTED_TO_CHATGPT_START_CONFIRMED');assert.equal(a.json.capacityEvidenceReused,true);assert.equal(a.json.codexAttemptedForCandidate,false);assert.equal(a.json.resetAt,seed.observation.resetAt);
 const derivedPath=path.join(f.root,'state','codex-fallback','INDIE-'+f.head+'.json'),derived=JSON.parse(fs.readFileSync(derivedPath));assert.equal(derived.candidate,f.head);assert.equal(derived.capacityEvidenceReused,true);assert.equal(derived.codexAttemptedForCandidate,false);assert.equal(derived.capacityObservationHash,digest(seed.observation));assert.equal(derived.sourceCapacityReceiptHash,digest(JSON.parse(fs.readFileSync(seed.sourcePath))));
 const state=JSON.parse(fs.readFileSync(f.state)),record=Object.values(state.records)[0];assert.equal(record.codexStartedAt,undefined);assert.equal(record.capacityEvidenceReused,true);
});

test('expired capacity horizon becomes retry-eligible and Codex is attempted again',()=>{
 const f=fixture('expired-capacity-retry','7'.repeat(40)),seed=seedCapacityObservation(f),observation=JSON.parse(fs.readFileSync(seed.observationPath)),cf=path.join(f.root,'codex.json');observation.resetAt=new Date(Date.now()-60*1000).toISOString();write(seed.observationPath,observation);write(cf,{schemaVersion:1,status:89,stdout:'',stderr:'AUTH_FAILED'});
 const a=run(f,{PINO_REVIEW_ENSURE_TEST_CODEX_FIXTURE:cf});assert.equal(a.x.status,0);assert.equal(a.json.provider,'CODEX_DIRECT');assert.equal(a.json.status,'REVIEW_RUNNING');
 const state=JSON.parse(fs.readFileSync(f.state)),record=Object.values(state.records)[0];assert.ok(record.codexStartedAt);assert.equal(record.capacityEvidenceReused,undefined);
});

test('Codex-first fixture reaches durable verdict and is idempotent across fresh processes',()=>{
 const f=fixture('codex-pass'),ap=authority(f),cf=path.join(f.root,'codex.json');write(cf,{schemaVersion:1,status:0,stdout:JSON.stringify({codexDirectReviewVerified:true,reviewAuthorityPath:ap})+'\n',stderr:''});
 const env={PINO_REVIEW_ENSURE_TEST_CODEX_FIXTURE:cf};
 const a=run(f,env);assert.equal(a.x.status,0);assert.equal(a.json.status,'REVIEW_RUNNING');assert.equal(a.json.provider,'CODEX_DIRECT');
 const b=run(f,env);assert.equal(b.x.status,0);assert.equal(b.json.status,'REVIEW_VERDICT');assert.equal(b.json.verdict,'PASS');assert.equal(b.json.provider,'CODEX_DIRECT');
 const c=run(f,env);assert.equal(c.json.idempotent,true);assert.equal(c.json.verdict,'PASS');
 const s=JSON.parse(fs.readFileSync(f.state));assert.equal(Object.keys(s.records).length,1);
});

test('capacity exhaustion transitions to ChatGPT only after exact receipt and START_CONFIRMED',()=>{
 const f=fixture('capacity-fallback','b'.repeat(40)),receipt=path.join(f.root,'receipt.json'),cf=path.join(f.root,'codex.json'),start=path.join(f.root,'chat-start.json'),status=path.join(f.root,'chat-status.json');
 write(receipt,{schemaVersion:1,kind:'PINO_CODEX_FALLBACK_ELIGIBILITY',reviewKind:'INDIE',candidate:f.head,repository:'vmtct/pino-core',exitClass:'CAPACITY_EXHAUSTED',allAuthenticatedProfilesExhausted:true,profilesAttempted:['/home/tri/.codex-vmtct97'],createdAt:new Date().toISOString()});
 write(cf,{schemaVersion:1,status:88,stdout:'',stderr:`PINO_CODEX_FALLBACK_RECEIPT=${receipt}\n`});write(start,{auditWorkId:'review-ensure:capacity-fallback:bbbbbbbbbbbb',conversationUrl:'https://chatgpt.com/c/test-fallback',label:'fixture-audit',round:1});
 write(status,{ok:true,work:{status:'REVIEWING',currentRound:1,rounds:[{round:1,status:'REVIEWING'}]}});
 const env={PINO_REVIEW_ENSURE_TEST_CODEX_FIXTURE:cf,PINO_REVIEW_ENSURE_TEST_CHATGPT_START_FIXTURE:start,PINO_REVIEW_ENSURE_TEST_CHATGPT_STATUS_FIXTURE:status};
 const a=run(f,env);assert.equal(a.json.provider,'CODEX_DIRECT');
 const b=run(f,env);assert.equal(b.x.status,0);assert.equal(b.json.status,'REVIEW_RUNNING');assert.equal(b.json.provider,'CHATGPT_AUDIT_FALLBACK');assert.equal(b.json.transition,'CAPACITY_EXHAUSTED_TO_CHATGPT_START_CONFIRMED');assert.equal(b.json.conversationUrl,start.conversationUrl??'https://chatgpt.com/c/test-fallback');
 write(status,{ok:true,work:{status:'REVIEW_PASS',currentRound:1,rounds:[{round:1,status:'PASS',result:{verdict:'PASS',p0:0,p1:0,blocking_findings:[],summary:'clean'},resultEvidenceHash:'fixture-hash',consumedAt:new Date().toISOString()}]}});
 const c=run(f,env);assert.equal(c.x.status,0);assert.equal(c.json.status,'REVIEW_VERDICT');assert.equal(c.json.provider,'CHATGPT_AUDIT_FALLBACK');assert.equal(c.json.verdict,'PASS');
 assert.equal(fs.existsSync(path.join(f.root,'state','codex-capacity','vmtct97.json')),false,'capacity cache must not be invented when provider reset horizon is absent');
});

test('non-capacity Codex failure is fail-closed and never starts ChatGPT',()=>{
 const f=fixture('auth-fail','c'.repeat(40)),cf=path.join(f.root,'codex.json'),start=path.join(f.root,'chat-start.json');write(cf,{schemaVersion:1,status:89,stdout:'',stderr:'AUTH_FAILED'});write(start,{auditWorkId:'should-not-run',conversationUrl:'https://chatgpt.com/c/forbidden'});
 const env={PINO_REVIEW_ENSURE_TEST_CODEX_FIXTURE:cf,PINO_REVIEW_ENSURE_TEST_CHATGPT_START_FIXTURE:start};run(f,env);const b=run(f,env);assert.equal(b.x.status,2);assert.equal(b.json.status,'BLOCKED');assert.match(b.json.reason,/CODEX_NON_CAPACITY_FAILURE_RC_89/);
 const s=JSON.parse(fs.readFileSync(f.state));const rec=Object.values(s.records)[0];assert.equal(rec.provider,'CODEX_DIRECT');assert.equal(rec.conversationUrl,undefined);
});

test('candidate drift creates a new obligation and retries Codex instead of reusing old verdict',()=>{
 const f=fixture('drift','d'.repeat(40)),a1=authority(f),c1=path.join(f.root,'codex1.json');write(c1,{schemaVersion:1,status:0,stdout:JSON.stringify({codexDirectReviewVerified:true,reviewAuthorityPath:a1})+'\n',stderr:''});let env={PINO_REVIEW_ENSURE_TEST_CODEX_FIXTURE:c1};run(f,env);assert.equal(run(f,env).json.verdict,'PASS');
 const newHead='e'.repeat(40),l=JSON.parse(fs.readFileSync(f.ledger));l.candidate.headSha=newHead;write(f.ledger,l);const sp=JSON.parse(fs.readFileSync(f.spec));sp.exactHeadCi.headSha=newHead;write(f.spec,sp);f.head=newHead;const a2=authority(f),c2=path.join(f.root,'codex2.json');write(c2,{schemaVersion:1,status:0,stdout:JSON.stringify({codexDirectReviewVerified:true,reviewAuthorityPath:a2})+'\n',stderr:''});env={PINO_REVIEW_ENSURE_TEST_CODEX_FIXTURE:c2};const n=run(f,env);assert.equal(n.json.status,'REVIEW_RUNNING');assert.equal(n.json.provider,'CODEX_DIRECT');const s=JSON.parse(fs.readFileSync(f.state));assert.equal(Object.keys(s.records).length,2);
});


test('stale capacity receipt blocks durably and never starts ChatGPT',()=>{
 const f=fixture('stale-capacity','f'.repeat(40)),receipt=path.join(f.root,'receipt.json'),cf=path.join(f.root,'codex.json'),start=path.join(f.root,'chat-start.json');
 write(receipt,{schemaVersion:1,kind:'PINO_CODEX_FALLBACK_ELIGIBILITY',reviewKind:'INDIE',candidate:f.head,repository:'vmtct/pino-core',exitClass:'CAPACITY_EXHAUSTED',allAuthenticatedProfilesExhausted:true,profilesAttempted:['/home/tri/.codex-vmtct97'],createdAt:new Date(Date.now()-2*60*60*1000).toISOString()});write(cf,{schemaVersion:1,status:88,stdout:'',stderr:`PINO_CODEX_FALLBACK_RECEIPT=${receipt}\n`});write(start,{auditWorkId:'forbidden',conversationUrl:'https://chatgpt.com/c/forbidden'});
 const env={PINO_REVIEW_ENSURE_TEST_CODEX_FIXTURE:cf,PINO_REVIEW_ENSURE_TEST_CHATGPT_START_FIXTURE:start};run(f,env);const b=run(f,env);assert.equal(b.x.status,2);assert.equal(b.json.status,'BLOCKED');assert.match(b.json.reason,/REVIEW_ENSURE_CAPACITY_RECEIPT_STALE/);const c=run(f,env);assert.equal(c.x.status,2);assert.equal(c.json.idempotent,true);assert.equal(c.json.provider,'CODEX_DIRECT');
});

test('wrong-head capacity receipt blocks durably',()=>{
 const f=fixture('wrong-head-capacity','1'.repeat(40)),receipt=path.join(f.root,'receipt.json'),cf=path.join(f.root,'codex.json');write(receipt,{schemaVersion:1,kind:'PINO_CODEX_FALLBACK_ELIGIBILITY',reviewKind:'INDIE',candidate:'2'.repeat(40),repository:'vmtct/pino-core',exitClass:'CAPACITY_EXHAUSTED',allAuthenticatedProfilesExhausted:true,profilesAttempted:['/home/tri/.codex-vmtct97'],createdAt:new Date().toISOString()});write(cf,{schemaVersion:1,status:88,stdout:'',stderr:`PINO_CODEX_FALLBACK_RECEIPT=${receipt}\n`});const env={PINO_REVIEW_ENSURE_TEST_CODEX_FIXTURE:cf};run(f,env);const b=run(f,env);assert.equal(b.x.status,2);assert.match(b.json.reason,/REVIEW_ENSURE_CAPACITY_RECEIPT_INVALID/);
});

test('exact-head CI mismatch fails before provider dispatch',()=>{
 const f=fixture('ci-mismatch','3'.repeat(40)),sp=JSON.parse(fs.readFileSync(f.spec));sp.exactHeadCi.headSha='4'.repeat(40);write(f.spec,sp);const a=run(f,{});assert.equal(a.x.status,1);assert.match(a.x.stderr,/REVIEW_ENSURE_CI_HEAD_MISMATCH/);assert.equal(fs.existsSync(f.state),false);
});

test('concurrent cold-start ensure calls coalesce to one durable obligation',async()=>{
 const f=fixture('concurrent','5'.repeat(40)),ap=authority(f),cf=path.join(f.root,'codex.json');write(cf,{schemaVersion:1,status:0,stdout:JSON.stringify({codexDirectReviewVerified:true,reviewAuthorityPath:ap})+'\n',stderr:''});const env={PINO_REVIEW_ENSURE_TEST_CODEX_FIXTURE:cf};const [a,b]=await Promise.all([runAsync(f,env),runAsync(f,env)]);assert.equal(a.code,0);assert.equal(b.code,0);const s=JSON.parse(fs.readFileSync(f.state));assert.equal(Object.keys(s.records).length,1);const statuses=[a.json?.status,b.json?.status];assert.ok(statuses.every(x=>['REVIEW_RUNNING','REVIEW_VERDICT'].includes(x)));
});

