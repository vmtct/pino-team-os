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
function runCommand(f,cmd,env={}){const x=spawnSync(process.execPath,[TOOL,cmd,f.spec],{encoding:'utf8',env:{...process.env,NODE_ENV:'test',PINO_SOP_ROOT:f.root,PINO_REVIEW_ENSURE_STATE:f.state,...env}});let json=null;try{json=JSON.parse(x.stdout||x.stderr)}catch{}return{x,json}}
function run(f,env={}){return runCommand(f,'ensure',env)}
function consume(f,env={}){return runCommand(f,'consume',env)}
function recover(f,env={}){return runCommand(f,'recover-preflight',env)}
function runAsyncCommand(f,cmd,env={}){return new Promise(resolve=>{const x=spawn(process.execPath,[TOOL,cmd,f.spec],{env:{...process.env,NODE_ENV:'test',PINO_SOP_ROOT:f.root,PINO_REVIEW_ENSURE_STATE:f.state,...env}});let out='',err='';x.stdout.on('data',d=>out+=d);x.stderr.on('data',d=>err+=d);x.on('close',code=>{let json=null;try{json=JSON.parse(out||err)}catch{}resolve({code,json,out,err})})})}
function runAsync(f,env={}){return runAsyncCommand(f,'ensure',env)}
function consumeAsync(f,env={}){return runAsyncCommand(f,'consume',env)}

test('RESET_AT parser normalizes real Codex clock-only quota horizon in Asia/Ho_Chi_Minh',()=>{
 const parsed=parseResetAt("ERROR: You've hit your usage limit. Upgrade to Pro or try again at 6:04 PM.",'2026-10-12T09:35:36.087Z');
 assert.deepEqual(parsed,{resetAtRaw:'6:04 PM',resetAt:'2026-10-12T18:04:00+07:00',timezone:'Asia/Ho_Chi_Minh',timezoneOffsetMinutes:420});
 assert.equal(parseResetAt("ERROR: You've hit your usage limit.",'2026-10-12T09:35:36.087Z'),null);
});

function seedCapacityObservation(f,{minutesAhead=30}={}){
 const observedAt=new Date(Date.now()-5*60*1000).toISOString(),futureLocal=new Date(Date.now()+minutesAhead*60*1000+7*60*60*1000);let h=futureLocal.getUTCHours();const marker=h>=12?'PM':'AM',h12=h%12||12,raw=`${h12}:${String(futureLocal.getUTCMinutes()).padStart(2,'0')} ${marker}`,providerEvidence=`ERROR: You've hit your usage limit. Upgrade to Pro or try again at ${raw}.`,parsed=parseResetAt(providerEvidence,observedAt),sourceCandidate='9'.repeat(40),sourcePath=path.join(f.root,'state','codex-fallback','INDIE-'+sourceCandidate+'.json'),source={schemaVersion:1,kind:'PINO_CODEX_FALLBACK_ELIGIBILITY',reviewKind:'INDIE',candidate:sourceCandidate,repository:'vmtct/pino-core',exitClass:'CAPACITY_EXHAUSTED',allAuthenticatedProfilesExhausted:true,profilesAttempted:['/home/tri/.codex-vmtct97'],requiredRiskFamilies:['RUNTIME_BINDINGS'],riskContractHash:'1'.repeat(64),codexSourceThreadId:'11111111-1111-4111-8111-111111111111',codexSourceReceiptSha256:'2'.repeat(64),reviewObligationKey:'3'.repeat(64),createdAt:observedAt,evidenceLog:path.join(f.root,'source-codex.log')};
 write(source.evidenceLog,providerEvidence+'\n');write(sourcePath,source);const observation={schemaVersion:1,kind:'PINO_CODEX_CAPACITY_OBSERVATION',provider:'OPENAI_CODEX',capacityDomain:'openai:vmtct97',profileId:'vmtct97',state:'EXHAUSTED',observedAt,...parsed,profilesAttempted:source.profilesAttempted,allAuthenticatedProfilesExhausted:true,sourceClass:'PROVIDER_USAGE_LIMIT',sourceReceiptPath:sourcePath,sourceReceiptHash:digest(source),sourceCandidate,sourceRepository:'vmtct/pino-core',evidenceLog:source.evidenceLog,evidenceLogSha256:crypto.createHash('sha256').update(fs.readFileSync(source.evidenceLog)).digest('hex'),providerEvidence,providerEvidenceSha256:crypto.createHash('sha256').update(providerEvidence).digest('hex'),persistedAt:new Date().toISOString()};
 const observationPath=path.join(f.root,'state','codex-capacity','vmtct97.json');write(observationPath,observation);return{observation,observationPath,sourcePath};
}

test('fresh INDIE reuses active single-account exhaustion and skips redundant Codex launch',()=>{
 const f=fixture('known-capacity-skip','6'.repeat(40)),seed=seedCapacityObservation(f),cf=path.join(f.root,'codex-should-not-run.json'),start=path.join(f.root,'chat-start.json'),risk=path.join(f.root,'risk.json'),binding=path.join(f.root,'binding.json'),claim=path.join(f.root,'claim.json');
 write(cf,{schemaVersion:1,status:89,stdout:'',stderr:'SHOULD_NOT_RUN'});write(start,{auditWorkId:'review-ensure:known-capacity-skip:666666666666',conversationUrl:'https://chatgpt.com/c/known-capacity',label:'known-capacity-audit',round:1});write(risk,{bindingHash:'4'.repeat(64),families:['RUNTIME_BINDINGS']});write(binding,{ok:true,obligationKey:'5'.repeat(64),candidateVectorHash:'6'.repeat(64)});write(claim,{ok:true,state:'CODEX_CAPACITY',obligationKey:'5'.repeat(64)});
 const a=run(f,{PINO_REVIEW_ENSURE_TEST_CODEX_FIXTURE:cf,PINO_REVIEW_ENSURE_TEST_CHATGPT_START_FIXTURE:start,PINO_REVIEW_ENSURE_TEST_RISK_FIXTURE:risk,PINO_REVIEW_ENSURE_TEST_FENCE_BINDING_FIXTURE:binding,PINO_REVIEW_ENSURE_TEST_REUSED_CAPACITY_CLAIM_FIXTURE:claim});assert.equal(a.x.status,0);assert.equal(a.json.provider,'CHATGPT_AUDIT_FALLBACK');assert.equal(a.json.transition,'KNOWN_CAPACITY_EXHAUSTED_TO_CHATGPT_START_CONFIRMED');assert.equal(a.json.capacityEvidenceReused,true);assert.equal(a.json.codexAttemptedForCandidate,false);assert.equal(a.json.resetAt,seed.observation.resetAt);
 const derivedPath=path.join(f.root,'state','codex-fallback','INDIE-'+f.head+'.json'),derived=JSON.parse(fs.readFileSync(derivedPath));assert.equal(derived.candidate,f.head);assert.equal(derived.capacityEvidenceReused,true);assert.equal(derived.codexAttemptedForCandidate,false);assert.equal(derived.capacityObservationHash,digest(seed.observation));assert.equal(derived.sourceCapacityReceiptHash,digest(JSON.parse(fs.readFileSync(seed.sourcePath))));assert.deepEqual(derived.requiredRiskFamilies,['RUNTIME_BINDINGS']);assert.equal(derived.riskContractHash,'4'.repeat(64));assert.equal(derived.codexSourceThreadId,'11111111-1111-4111-8111-111111111111');assert.equal(derived.codexSourceReceiptSha256,'2'.repeat(64));assert.equal(derived.reviewObligationKey,'5'.repeat(64));
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

test('review verdict consumption is atomic exactly-once and remains idempotent after restart',async()=>{
 const f=fixture('consume-once','9'.repeat(40)),ap=authority(f),cf=path.join(f.root,'codex.json');write(cf,{schemaVersion:1,status:0,stdout:JSON.stringify({codexDirectReviewVerified:true,reviewAuthorityPath:ap})+'\n',stderr:''});const env={PINO_REVIEW_ENSURE_TEST_CODEX_FIXTURE:cf};run(f,env);assert.equal(run(f,env).json.status,'REVIEW_VERDICT');
 const [x,y]=await Promise.all([consumeAsync(f,env),consumeAsync(f,env)]);assert.equal(x.code,0);assert.equal(y.code,0);assert.deepEqual([x.json.idempotent,y.json.idempotent].sort(),[false,true]);assert.ok([x.json.status,y.json.status].every(v=>v==='CONSUMED'));
 const s=JSON.parse(fs.readFileSync(f.state)),r=Object.values(s.records)[0];assert.equal(r.status,'CONSUMED');assert.equal(r.consumeCount,1);assert.ok(r.orchestratorConsumedAt);assert.equal(r.consumerId,'consume-once');
 const c=consume(f,env);assert.equal(c.x.status,0);assert.equal(c.json.status,'CONSUMED');assert.equal(c.json.idempotent,true);const d=run(f,env);assert.equal(d.json.status,'CONSUMED');assert.equal(d.json.idempotent,true);
});

test('consume before verdict fails closed without creating state',()=>{
 const f=fixture('consume-not-ready','0'.repeat(40)),a=consume(f,{});assert.equal(a.x.status,1);assert.match(a.x.stderr,/REVIEW_ENSURE_CONSUME_NOT_READY:MISSING/);assert.equal(fs.existsSync(f.state),false);
});

test('capacity exhaustion transitions to ChatGPT only after exact receipt and START_CONFIRMED',()=>{
 const f=fixture('capacity-fallback','b'.repeat(40)),receipt=path.join(f.root,'receipt.json'),cf=path.join(f.root,'codex.json'),start=path.join(f.root,'chat-start.json'),status=path.join(f.root,'chat-status.json');
 write(receipt,{schemaVersion:1,kind:'PINO_CODEX_FALLBACK_ELIGIBILITY',reviewKind:'INDIE',candidate:f.head,repository:'vmtct/pino-core',exitClass:'CAPACITY_EXHAUSTED',allAuthenticatedProfilesExhausted:true,profilesAttempted:['/home/tri/.codex-vmtct97'],requiredRiskFamilies:['RUNTIME_BINDINGS'],riskContractHash:'a'.repeat(64),codexSourceThreadId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',codexSourceReceiptSha256:'b'.repeat(64),reviewObligationKey:'c'.repeat(64),createdAt:new Date().toISOString()});
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
 write(receipt,{schemaVersion:1,kind:'PINO_CODEX_FALLBACK_ELIGIBILITY',reviewKind:'INDIE',candidate:f.head,repository:'vmtct/pino-core',exitClass:'CAPACITY_EXHAUSTED',allAuthenticatedProfilesExhausted:true,profilesAttempted:['/home/tri/.codex-vmtct97'],requiredRiskFamilies:['RUNTIME_BINDINGS'],riskContractHash:'a'.repeat(64),codexSourceThreadId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',codexSourceReceiptSha256:'b'.repeat(64),reviewObligationKey:'c'.repeat(64),createdAt:new Date(Date.now()-2*60*60*1000).toISOString()});write(cf,{schemaVersion:1,status:88,stdout:'',stderr:`PINO_CODEX_FALLBACK_RECEIPT=${receipt}\n`});write(start,{auditWorkId:'forbidden',conversationUrl:'https://chatgpt.com/c/forbidden'});
 const env={PINO_REVIEW_ENSURE_TEST_CODEX_FIXTURE:cf,PINO_REVIEW_ENSURE_TEST_CHATGPT_START_FIXTURE:start};run(f,env);const b=run(f,env);assert.equal(b.x.status,2);assert.equal(b.json.status,'BLOCKED');assert.match(b.json.reason,/REVIEW_ENSURE_CAPACITY_RECEIPT_STALE/);const c=run(f,env);assert.equal(c.x.status,2);assert.equal(c.json.idempotent,true);assert.equal(c.json.provider,'CODEX_DIRECT');
});

test('wrong-head capacity receipt blocks durably',()=>{
 const f=fixture('wrong-head-capacity','1'.repeat(40)),receipt=path.join(f.root,'receipt.json'),cf=path.join(f.root,'codex.json');write(receipt,{schemaVersion:1,kind:'PINO_CODEX_FALLBACK_ELIGIBILITY',reviewKind:'INDIE',candidate:'2'.repeat(40),repository:'vmtct/pino-core',exitClass:'CAPACITY_EXHAUSTED',allAuthenticatedProfilesExhausted:true,profilesAttempted:['/home/tri/.codex-vmtct97'],requiredRiskFamilies:['RUNTIME_BINDINGS'],riskContractHash:'a'.repeat(64),codexSourceThreadId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',codexSourceReceiptSha256:'b'.repeat(64),reviewObligationKey:'c'.repeat(64),createdAt:new Date().toISOString()});write(cf,{schemaVersion:1,status:88,stdout:'',stderr:`PINO_CODEX_FALLBACK_RECEIPT=${receipt}\n`});const env={PINO_REVIEW_ENSURE_TEST_CODEX_FIXTURE:cf};run(f,env);const b=run(f,env);assert.equal(b.x.status,2);assert.match(b.json.reason,/REVIEW_ENSURE_CAPACITY_RECEIPT_INVALID/);
});

test('exact-head CI mismatch fails before provider dispatch',()=>{
 const f=fixture('ci-mismatch','3'.repeat(40)),sp=JSON.parse(fs.readFileSync(f.spec));sp.exactHeadCi.headSha='4'.repeat(40);write(f.spec,sp);const a=run(f,{});assert.equal(a.x.status,1);assert.match(a.x.stderr,/REVIEW_ENSURE_CI_HEAD_MISMATCH/);assert.equal(fs.existsSync(f.state),false);
});

test('concurrent cold-start ensure calls coalesce to one durable obligation',async()=>{
 const f=fixture('concurrent','5'.repeat(40)),ap=authority(f),cf=path.join(f.root,'codex.json');write(cf,{schemaVersion:1,status:0,stdout:JSON.stringify({codexDirectReviewVerified:true,reviewAuthorityPath:ap})+'\n',stderr:''});const env={PINO_REVIEW_ENSURE_TEST_CODEX_FIXTURE:cf};const [a,b]=await Promise.all([runAsync(f,env),runAsync(f,env)]);assert.equal(a.code,0);assert.equal(b.code,0);const s=JSON.parse(fs.readFileSync(f.state));assert.equal(Object.keys(s.records).length,1);const statuses=[a.json?.status,b.json?.status];assert.ok(statuses.every(x=>['REVIEW_RUNNING','REVIEW_VERDICT'].includes(x)));
});



test('global PAP-507 overlay blocks second Codex after prior blocking review and stop restores canonical retry',()=>{
 const f=fixture('global-short-chain','6'.repeat(40)),prior='7'.repeat(40),config=path.join(f.root,'state','experiments','review-chain-short-v1.json');
 write(config,{schemaVersion:1,kind:'PINO_REVIEW_EXPERIMENT_CONFIG',experiment:'REVIEW_CHAIN_SHORT_V1',jiraKey:'PAP-507',active:true,globalDefault:true,scopeMode:'GLOBAL_DEFAULT_UNTIL_FOUNDER_STOP',allowedHosts:['*'],effectiveFrom:'2026-10-12T00:00:00+07:00',maxCodexSubstantiveRunsPerChain:1,maxChatgptRemediationAuditsPerChain:1,maxIndependentReviewsPerChain:2});
 write(f.state,{schemaVersion:1,revision:1,records:{prior:{schemaVersion:1,obligationKey:'prior',obligationId:'global-short-chain',workId:'global-short-chain',reviewKind:'INDIE',repository:'vmtct/pino-core',candidate:prior,pr:1,status:'CONSUMED',provider:'CODEX_DIRECT',verdict:'FINDINGS',p0:0,p1:1,blockingFindings:['P1 prior'],authorityPath:'C:/evidence/prior.json',evidenceHash:'8'.repeat(64),consumedAt:new Date().toISOString(),orchestratorConsumedAt:new Date().toISOString(),consumeCount:1,consumerId:'prior'}}});
 const blocked=run(f,{});assert.equal(blocked.x.status,0);assert.equal(blocked.json.status,'REVIEW_CHAIN_SHORT_R2_REQUIRED');assert.equal(blocked.json.priorCandidate,prior);assert.equal(blocked.json.priorProvider,'CODEX_DIRECT');assert.equal(blocked.json.reason,'BLOCK_SECOND_CODEX_OR_FRESH_FULL_REVIEW_ROUTE_TO_NARROW_CHATGPT_REMEDIATION_VERIFY');
 const c=JSON.parse(fs.readFileSync(config));c.active=false;c.globalDefault=false;write(config,c);
 const ap=authority(f),cf=path.join(f.root,'codex-after-stop.json');write(cf,{schemaVersion:1,status:0,stdout:JSON.stringify({codexDirectReviewVerified:true,reviewAuthorityPath:ap})+'\n',stderr:''});const resumed=run(f,{PINO_REVIEW_ENSURE_TEST_CODEX_FIXTURE:cf});assert.equal(resumed.x.status,0);assert.equal(resumed.json.status,'REVIEW_RUNNING');assert.equal(resumed.json.provider,'CODEX_DIRECT');
});

test('Codex worker carries exact repository and PR binding into canonical launcher',()=>{
 const source=fs.readFileSync(TOOL,'utf8');
 assert.ok(source.includes("if(!c.pr)fail('REVIEW_ENSURE_PR_REQUIRED')"));
 assert.ok(source.includes('repository:c.repo,pr:c.pr,candidate:c.head'));
 assert.ok(source.includes('PINO_REVIEW_REPOSITORY=${JSON.stringify(s.repository)}'));
 assert.ok(source.includes('PINO_REVIEW_PR_NUMBER=${JSON.stringify(String(s.pr))}'));
});

test('proven pre-review RC90 can be recovered without consuming review budget and preserves receipt lineage',()=>{
 const f=fixture('recover-preflight','8'.repeat(40)),cf=path.join(f.root,'codex-preflight.json');write(cf,{schemaVersion:1,status:90,stdout:'',stderr:'ERROR: REVIEW_RISK_CONTRACT_UNRESOLVED:ledger:FileNotFoundError\nERROR: canonical review risk contract unresolved\n'});const env={PINO_REVIEW_ENSURE_TEST_CODEX_FIXTURE:cf};
 const a=run(f,env);assert.equal(a.json.status,'REVIEW_RUNNING');const b=run(f,env);assert.equal(b.x.status,2);assert.equal(b.json.status,'BLOCKED');assert.equal(b.json.reason,'CODEX_NON_CAPACITY_FAILURE_RC_90');
 const c=recover(f,env);assert.equal(c.x.status,0);assert.equal(c.json.status,'PRE_REVIEW_RETRY_READY');assert.equal(c.json.noSideEffect,true);assert.ok(fs.existsSync(c.json.recoveryReceiptPath));const receipt=JSON.parse(fs.readFileSync(c.json.recoveryReceiptPath));assert.equal(receipt.noSideEffect,true);assert.equal(receipt.failedBlockReason,'CODEX_NON_CAPACITY_FAILURE_RC_90');assert.deepEqual(Object.keys(JSON.parse(fs.readFileSync(f.state)).records),[]);
 const ap=authority(f),ok=path.join(f.root,'codex-pass-after-recover.json');write(ok,{schemaVersion:1,status:0,stdout:JSON.stringify({codexDirectReviewVerified:true,reviewAuthorityPath:ap})+'\n',stderr:''});const d=run(f,{PINO_REVIEW_ENSURE_TEST_CODEX_FIXTURE:ok});assert.equal(d.x.status,0);assert.equal(d.json.status,'REVIEW_RUNNING');assert.equal(d.json.provider,'CODEX_DIRECT');
});

test('pre-review recovery fails closed when candidate-bound side effect exists',()=>{
 const f=fixture('recover-side-effect','a'.repeat(40)),cf=path.join(f.root,'codex-preflight.json');write(cf,{schemaVersion:1,status:90,stdout:'',stderr:'ERROR: canonical review risk contract unresolved\n'});const env={PINO_REVIEW_ENSURE_TEST_CODEX_FIXTURE:cf};run(f,env);assert.equal(run(f,env).json.status,'BLOCKED');const receipt=path.join(f.root,'state','codex-source-receipts','INDIE-'+f.head+'.json');write(receipt,{schemaVersion:1,candidate:f.head});const c=recover(f,env);assert.equal(c.x.status,1);assert.match(c.x.stderr,/REVIEW_ENSURE_PRE_REVIEW_RECOVERY_SIDE_EFFECT/);assert.equal(Object.keys(JSON.parse(fs.readFileSync(f.state)).records).length,1);
});

test('brief-invalid pre-review failure aborts only the matching CODEX_INFLIGHT fence before retry',()=>{
 const f=fixture('recover-brief-invalid','b'.repeat(40)),cf=path.join(f.root,'codex-brief-invalid.json'),abortFixture=path.join(f.root,'abort.json');write(cf,{schemaVersion:1,status:1,stdout:'',stderr:'BRIEF_INVALID: missing risk_family,adjacent_surfaces,adjacent_sweep_result\nERROR: Codex reviewer failed with non-capacity rc=1\n'});write(abortFixture,{ok:true,state:'ABORTED_PRESTART',obligationKey:'fence-key',archivePath:path.join(f.root,'state','review-obligations','fence-key.aborted-prestart-1.json')});const env={PINO_REVIEW_ENSURE_TEST_CODEX_FIXTURE:cf,PINO_REVIEW_ENSURE_TEST_OBLIGATION_ABORT_FIXTURE:abortFixture};run(f,env);assert.equal(run(f,env).json.status,'BLOCKED');const od=path.join(f.root,'state','review-obligations'),op=path.join(od,'f'.repeat(64)+'.json');write(op,{schemaVersion:1,kind:'PINO_REVIEW_OBLIGATION',obligationKey:'fence-key',state:'CODEX_INFLIGHT',repository:'vmtct/pino-core',prNumber:1,candidate:f.head,riskContractHash:'1'.repeat(64)});const c=recover(f,env);assert.equal(c.x.status,0);assert.equal(c.json.status,'PRE_REVIEW_RETRY_READY');assert.equal(c.json.abortedReviewObligationKey,'fence-key');assert.equal(fs.existsSync(op),false);
});

test('arbitrary RC1 is not eligible for pre-review recovery',()=>{
 const f=fixture('recover-rc1-unsafe','c'.repeat(40)),cf=path.join(f.root,'codex-rc1.json');write(cf,{schemaVersion:1,status:1,stdout:'',stderr:'AUTH_FAILED\n'});const env={PINO_REVIEW_ENSURE_TEST_CODEX_FIXTURE:cf};run(f,env);assert.equal(run(f,env).json.status,'BLOCKED');const c=recover(f,env);assert.equal(c.x.status,1);assert.match(c.x.stderr,/REVIEW_ENSURE_PRE_REVIEW_RECOVERY_NOT_ELIGIBLE/);
});

test('source-controlled obligation fence exposes governed abort-prestart primitive',()=>{
 const source=fs.readFileSync(path.join(path.dirname(TOOL),'review-obligation-fence.py'),'utf8');assert.ok(source.includes('def abort_prestart(a):'));assert.ok(source.includes("state':'ABORTED_PRESTART"));assert.ok(source.includes("sub.add_parser('abort-prestart')"));
});


test('shared registry lock preserves concurrent mutations for different obligations',async()=>{
 const a=fixture('registry-a','1'.repeat(40)),b=fixture('registry-b','2'.repeat(40));b.state=a.state;const aa=authority(a),bb=authority(b),ca=path.join(a.root,'codex-a.json'),cb=path.join(b.root,'codex-b.json');write(ca,{schemaVersion:1,status:0,stdout:JSON.stringify({codexDirectReviewVerified:true,reviewAuthorityPath:aa})+'\n',stderr:''});write(cb,{schemaVersion:1,status:0,stdout:JSON.stringify({codexDirectReviewVerified:true,reviewAuthorityPath:bb})+'\n',stderr:''});
 const [x,y]=await Promise.all([runAsync(a,{PINO_REVIEW_ENSURE_TEST_CODEX_FIXTURE:ca}),runAsync(b,{PINO_REVIEW_ENSURE_TEST_CODEX_FIXTURE:cb})]);assert.equal(x.code,0);assert.equal(y.code,0);const st=JSON.parse(fs.readFileSync(a.state));assert.equal(Object.keys(st.records).length,2);assert.deepEqual(new Set(Object.values(st.records).map(r=>r.candidate)),new Set([a.head,b.head]));
});

test('malformed existing registry fails closed and is never replaced by empty state',()=>{
 const f=fixture('malformed-registry','3'.repeat(40));fs.mkdirSync(path.dirname(f.state),{recursive:true});fs.writeFileSync(f.state,'{"schemaVersion":1,"records":');const before=fs.readFileSync(f.state,'utf8'),a=run(f,{});assert.equal(a.x.status,1);assert.match(a.x.stderr,/REVIEW_ENSURE_STATE_PARSE_FAILED/);assert.equal(fs.readFileSync(f.state,'utf8'),before);
});

test('PR is bound in authority, record reuse and obligation identity',()=>{
 const f=fixture('pr-binding','4'.repeat(40)),ap=authority(f),bad=JSON.parse(fs.readFileSync(ap));bad.prNumber=999;const {evidenceHash,...core}=bad;bad.evidenceHash=digest(core);write(ap,bad);const cf=path.join(f.root,'codex.json');write(cf,{schemaVersion:1,status:0,stdout:JSON.stringify({codexDirectReviewVerified:true,reviewAuthorityPath:ap})+'\n',stderr:''});const env={PINO_REVIEW_ENSURE_TEST_CODEX_FIXTURE:cf};assert.equal(run(f,env).json.status,'REVIEW_RUNNING');const v=run(f,env);assert.equal(v.x.status,1);assert.match(v.x.stderr,/REVIEW_ENSURE_AUTHORITY_BINDING_MISMATCH/);
 const f2=fixture('pr-record','5'.repeat(40)),cf2=path.join(f2.root,'codex.json');write(cf2,{schemaVersion:1,status:89,stdout:'',stderr:'AUTH_FAIL'});run(f2,{PINO_REVIEW_ENSURE_TEST_CODEX_FIXTURE:cf2});const st=JSON.parse(fs.readFileSync(f2.state)),k=Object.keys(st.records)[0];st.records[k].pr=999;write(f2.state,st);const r=run(f2,{});assert.equal(r.x.status,1);assert.match(r.x.stderr,/REVIEW_ENSURE_RECORD_BINDING_MISMATCH/);
});

test('missing exact-head CI blocks before provider dispatch',()=>{
 const f=fixture('ci-required','6'.repeat(40)),sp=JSON.parse(fs.readFileSync(f.spec));delete sp.exactHeadCi;write(f.spec,sp);const a=run(f,{});assert.equal(a.x.status,1);assert.match(a.x.stderr,/REVIEW_ENSURE_CI_REQUIRED/);assert.equal(fs.existsSync(f.state),false);
});

test('reused capacity plumbing is source-controlled and fenced before ChatGPT claim',()=>{
 const ensure=fs.readFileSync(TOOL,'utf8'),fence=fs.readFileSync(path.join(path.dirname(TOOL),'review-obligation-fence.py'),'utf8'),verifier=fs.readFileSync(path.join(path.dirname(TOOL),'review-source-verifier.py'),'utf8');assert.ok(ensure.includes('claimReusedCapacity'));assert.ok(ensure.includes('codexSourceThreadId:source.codexSourceThreadId'));assert.ok(fence.includes('def claim_reused_capacity(a):'));assert.ok(fence.includes("state':'CODEX_CAPACITY'"));assert.ok(fence.includes("binding_parser('binding-key')"));assert.ok(verifier.includes('def active_capacity_reuse(a,t):'));assert.ok(verifier.includes("capacityEvidenceReused':reuse"));
});

test('worktree verifier runs git probes after cd and forbids pre-cd command substitution',()=>{
 const source=fs.readFileSync(TOOL,'utf8');
 assert.ok(source.includes("const script=`set -o pipefail; cd ${JSON.stringify(w)} && git rev-parse HEAD && git status --porcelain | wc -l && git remote get-url origin`;"));
 assert.equal(source.includes('\"$(git rev-parse HEAD)\"'),false);
});
