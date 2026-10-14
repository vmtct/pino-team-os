import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { observeFc, sendFc, rotateFc, applyFcAuthority, pageSnapshot, FC_PROJECT_URL } from './fc-tool-core.mjs';
const FC_PROJECT_CONVERSATION=FC_PROJECT_URL.replace(/\/project\/?$/,'/c/22222222-2222-2222-2222-222222222222');

function tempCache(){return fs.mkdtempSync(path.join(os.tmpdir(),'fc-tools-'));}
function clone(x){return JSON.parse(JSON.stringify(x));}
function validConversationUrl(v){try{const u=new URL(v);return u.protocol==='https:'&&u.hostname==='chatgpt.com'&&/\/c\/[^/?#]+\/?$/.test(u.pathname);}catch{return false;}}
function makeAdapter(options={}){
  const calls=[];
  const state={slot:'FC3',key:'PAP-174',cdpPort:9337,mode:'FC',host:'PAP-513',prompt:'old prompt',nextWakeAt:null,sessions:[{key:'PAP-900',summary:'session',status:'In Progress',description:'https://chatgpt.com/g/g-p-test/c/11111111-1111-1111-1111-111111111111',parent:'PAP-174'}]};
  return {
    calls,state,validConversationUrl,
    async readSlot(){return clone(state);},
    async readSession(key){return clone(state.sessions.find(x=>x.key===key));},
    async createStagedSession(slot,host,url){calls.push(['createStagedSession',slot,host,url]);const x={key:'PAP-901',summary:'staged',status:'To Do',description:url,parent:'PAP-174'};state.sessions.push(x);return {slot,bearer:'PAP-174',host,session:x.key,status:'To Do',url};},
    async activateSession(slot,key,host){calls.push(['activateSession',slot,key,host]);for(const s of state.sessions)s.status=s.key===key?'In Progress':'Done';state.host=host;if(options.badActivationUrl){const s=state.sessions.find(x=>x.key===key);s.description='https://chatgpt.com/g/g-p-test/c/99999999-9999-9999-9999-999999999999';}if(options.onActivate)await options.onActivate(state,key);return {slot,session:key,host,url:state.sessions.find(x=>x.key===key).description};},
    async transitionIssue(key,status){calls.push(['transitionIssue',key,status]);const x=state.sessions.find(s=>s.key===key);if(x)x.status=status;return {key,status};},
    async setHost(slot,value){calls.push(['setHost',slot,value]);if(options.failRestoreHost&&value==='PAP-513'&&state.host!=='PAP-513')throw new Error('HOST_ROLLBACK_FAILED');state.host=value;if(options.onSetHost)await options.onSetHost(state,value);return {slot,host:value};},
    async setPrompt(slot,value){calls.push(['setPrompt',slot,value]);state.prompt=value;if(options.onSetPrompt)await options.onSetPrompt(state,value);return {slot,prompt:value};},
    async setNextWakeAt(slot,value){calls.push(['setNextWakeAt',slot,value]);state.nextWakeAt=value==null?null:new Date(value).toISOString();if(options.failDesiredWake&&value!=null)throw new Error('WAKE_WRITE_FAILED');if(options.onSetNextWakeAt)await options.onSetNextWakeAt(state,value);return {slot,nextWakeAt:state.nextWakeAt};},
  };
}
function fakeLive(initial={},options={}){
  let typed='',clicks=0;
  const snap={href:'https://chatgpt.com/g/g-p-test/c/11111111-1111-1111-1111-111111111111',busy:false,users:[],assistants:[{id:'a1',text:'done'}],lastRole:'assistant',composerVisible:true,...clone(initial)};
  return {
    get typed(){return typed},get clicks(){return clicks},
    snapshot:async()=>clone(snap),composerText:async()=>options.composerText??'',
    type:async t=>{typed=t},
    clickSend:async()=>{clicks++;if(options.onClick)await options.onClick(snap,typed,clicks)},
    waitRealUrl:async()=> options.realUrl??FC_PROJECT_CONVERSATION,
    waitAssistantStable:async()=> options.assistantText??'BOOTSTRAP_READY custom',
    close:async()=>{},closePage:async()=>{},url:()=>snap.href,_snap:snap
  };
}

test('observe returns factual state only',async()=>{
  const adapter=makeAdapter(),live=fakeLive();
  const out=await observeFc('FC3',{adapter,transport:{openActive:async()=>live},cacheDir:tempCache(),skipWriterLease:true});
  assert.equal(out.tool,'fc.observe');assert.equal(out.host,'PAP-513');assert.equal(out.activeSession.key,'PAP-900');assert.equal(out.conversation.lastRole,'assistant');
});

test('send retains operation receipt and reconciles exact new delivery without duplicate click',async()=>{
  const adapter=makeAdapter(),cacheDir=tempCache(),first=fakeLive();
  const one=await sendFc('FC3','opaque caller text',{operationId:'op-1',adapter,transport:{openActive:async()=>first},cacheDir,skipWriterLease:true,verifyTimeoutMs:1});
  assert.equal(one.status,'SEND_UNCERTAIN_VERIFY_TIMEOUT');assert.equal(first.clicks,1);
  const second=fakeLive({users:[{id:'u2',text:'opaque caller text'}],lastRole:'user'});
  const two=await sendFc('FC3','opaque caller text',{operationId:'op-1',adapter,transport:{openActive:async()=>second},cacheDir,skipWriterLease:true});
  assert.equal(two.status,'RECONCILED_ACCEPTED');assert.equal(second.clicks,0);
  const third=fakeLive();
  const three=await sendFc('FC3','opaque caller text',{operationId:'op-1',adapter,transport:{openActive:async()=>third},cacheDir,skipWriterLease:true});
  assert.equal(three.idempotent,true);assert.equal(third.clicks,0);
});

test('historical matching user text cannot satisfy a new send operation',async()=>{
  const adapter=makeAdapter(),cacheDir=tempCache(),live=fakeLive({users:[{id:'old-user',text:'repeat me'}],lastRole:'assistant'});
  const one=await sendFc('FC3','repeat me',{operationId:'op-historical',adapter,transport:{openActive:async()=>live},cacheDir,skipWriterLease:true,verifyTimeoutMs:1});
  assert.equal(one.status,'SEND_UNCERTAIN_VERIFY_TIMEOUT');assert.equal(live.clicks,1);
  const two=await sendFc('FC3','repeat me',{operationId:'op-historical',adapter,transport:{openActive:async()=>live},cacheDir,skipWriterLease:true});
  assert.equal(two.status,'SEND_UNCERTAIN_RECONCILE');assert.equal(live.clicks,1);
});

test('legacy pending delivery blocks new tool send',async()=>{
  const adapter=makeAdapter(),cacheDir=tempCache(),legacy=tempCache();
  fs.writeFileSync(path.join(legacy,'fc-v2-fc3-state.json'),JSON.stringify({pendingSend:{prompt:'old unresolved'}}));
  const live=fakeLive();
  const out=await sendFc('FC3','new text',{operationId:'op-new',adapter,transport:{openActive:async()=>live},cacheDir,legacyCacheDir:legacy,skipWriterLease:true});
  assert.equal(out.status,'LEGACY_PENDING_SEND_RECONCILE_REQUIRED');assert.equal(live.clicks,0);
});

test('shared legacy writer lease blocks concurrent tool mutation',async()=>{
  const adapter=makeAdapter(),cacheDir=tempCache(),legacy=tempCache();
  fs.writeFileSync(path.join(legacy,'fc-v2-fc3.lock'),JSON.stringify({pid:process.pid,slot:'FC3'}));
  await assert.rejects(()=>sendFc('FC3','x',{operationId:'op-lock',adapter,transport:{openActive:async()=>fakeLive()},cacheDir,legacyCacheDir:legacy}),/FC_TOOL_WRITER_LEASE_HELD/);
});

test('exact conversation binding fails closed on wrong loaded conversation',async()=>{
  const adapter=makeAdapter(),live=fakeLive({href:'https://chatgpt.com/g/g-p-test/c/33333333-3333-3333-3333-333333333333'});
  await assert.rejects(()=>observeFc('FC3',{adapter,transport:{openActive:async()=>live},cacheDir:tempCache(),skipWriterLease:true}),/FC_TOOL_ACTIVE_CONVERSATION_BINDING_INVALID/);
});

test('rotate sends caller bootstrap exactly and activates only after exact receipt',async()=>{
  const adapter=makeAdapter(),cacheDir=tempCache(),active=fakeLive(),project=fakeLive({href:FC_PROJECT_URL}, {assistantText:'BOOTSTRAP_READY custom'});
  const out=await rotateFc('FC3',{bootstrap:'CALLER BOOTSTRAP EXACT',expectedReceipt:'BOOTSTRAP_READY custom'},{adapter,transport:{openActive:async()=>active,openProject:async()=>project},cacheDir,skipWriterLease:true});
  assert.equal(project.typed,'CALLER BOOTSTRAP EXACT');assert.equal(project.clicks,1);assert.equal(out.successor,'PAP-901');assert.equal(adapter.state.sessions.find(x=>x.key==='PAP-901').status,'In Progress');
});

test('ambiguous rotation activation is retained as recovery-required and cannot start over',async()=>{
  const adapter=makeAdapter({badActivationUrl:true}),cacheDir=tempCache(),active=fakeLive(),project=fakeLive({href:FC_PROJECT_URL}, {assistantText:'BOOTSTRAP_READY custom'}),transport={openActive:async()=>active,openProject:async()=>project};
  await assert.rejects(()=>rotateFc('FC3',{bootstrap:'CALLER BOOTSTRAP EXACT',expectedReceipt:'BOOTSTRAP_READY custom'},{adapter,transport,cacheDir,skipWriterLease:true}),/FC_TOOL_ACTIVATION_READBACK_MISMATCH/);
  const saved=JSON.parse(fs.readFileSync(path.join(cacheDir,'fc-tool-fc3-state.json'),'utf8'));assert.equal(saved.rotationTxn.phase,'RECOVERY_REQUIRED');
  await assert.rejects(()=>rotateFc('FC3',{bootstrap:'CALLER BOOTSTRAP EXACT',expectedReceipt:'BOOTSTRAP_READY custom'},{adapter,transport,cacheDir,skipWriterLease:true}),/FC_TOOL_ROTATION_RECONCILE_REQUIRED/);
});

test('durable recovery fence blocks legacy writer until the exact send is reconciled',async()=>{
  const adapter=makeAdapter(),cacheDir=tempCache(),legacy=tempCache(),first=fakeLive();
  const one=await sendFc('FC3','fenced text',{operationId:'op-fence',adapter,transport:{openActive:async()=>first},cacheDir,legacyCacheDir:legacy,verifyTimeoutMs:1});
  assert.equal(one.status,'SEND_UNCERTAIN_VERIFY_TIMEOUT');const lock=path.join(legacy,'fc-v2-fc3.lock');assert.equal(fs.statSync(lock).isDirectory(),true);
  assert.throws(()=>{try{fs.unlinkSync(lock);}catch{}const fd=fs.openSync(lock,'wx');fs.closeSync(fd);},/EEXIST|EISDIR|EPERM/);
  await assert.rejects(()=>sendFc('FC3','fenced text',{operationId:'op-fence',adapter,transport:{openActive:async()=>fakeLive()},cacheDir,legacyCacheDir:legacy}),/FC_TOOL_WRITER_LEASE_HELD/);
  const ownerPath=path.join(lock,'owner.json'),owner=JSON.parse(fs.readFileSync(ownerPath,'utf8'));owner.pid=99999999;fs.writeFileSync(ownerPath,JSON.stringify(owner));
  await assert.rejects(()=>sendFc('FC3','other',{operationId:'op-other',adapter,transport:{openActive:async()=>fakeLive()},cacheDir,legacyCacheDir:legacy}),/FC_TOOL_RECOVERY_FENCE_REQUIRES_MATCH/);
  const second=fakeLive({users:[{id:'u2',text:'fenced text'}],lastRole:'user'});const two=await sendFc('FC3','fenced text',{operationId:'op-fence',adapter,transport:{openActive:async()=>second},cacheDir,legacyCacheDir:legacy});
  assert.equal(two.status,'RECONCILED_ACCEPTED');assert.equal(fs.existsSync(lock),false);
});

test('rotation click error after possible dispatch is recovery-required and cannot retry',async()=>{
  const adapter=makeAdapter(),cacheDir=tempCache(),active=fakeLive(),project=fakeLive({href:FC_PROJECT_URL},{onClick:async()=>{throw new Error('CLICK_ACK_LOST')},assistantText:'BOOTSTRAP_READY custom'}),transport={openActive:async()=>active,openProject:async()=>project};
  await assert.rejects(()=>rotateFc('FC3',{bootstrap:'CALLER BOOTSTRAP EXACT',expectedReceipt:'BOOTSTRAP_READY custom'},{adapter,transport,cacheDir,skipWriterLease:true}),/CLICK_ACK_LOST/);
  const saved=JSON.parse(fs.readFileSync(path.join(cacheDir,'fc-tool-fc3-state.json'),'utf8'));assert.equal(saved.rotationTxn.phase,'RECOVERY_REQUIRED');
  await assert.rejects(()=>rotateFc('FC3',{bootstrap:'CALLER BOOTSTRAP EXACT',expectedReceipt:'BOOTSTRAP_READY custom'},{adapter,transport,cacheDir,skipWriterLease:true}),/FC_TOOL_ROTATION_RECONCILE_REQUIRED/);
});

test('host-only activation mismatch cannot reconcile to completed',async()=>{
  const adapter=makeAdapter({onActivate:async state=>{state.host='PAP-WRONG';}}),cacheDir=tempCache(),active=fakeLive(),project=fakeLive({href:FC_PROJECT_URL},{assistantText:'BOOTSTRAP_READY custom'}),transport={openActive:async()=>active,openProject:async()=>project};
  await assert.rejects(()=>rotateFc('FC3',{bootstrap:'CALLER BOOTSTRAP EXACT',expectedReceipt:'BOOTSTRAP_READY custom'},{adapter,transport,cacheDir,skipWriterLease:true}),/FC_TOOL_ACTIVATION_READBACK_MISMATCH/);
  const saved=JSON.parse(fs.readFileSync(path.join(cacheDir,'fc-tool-fc3-state.json'),'utf8'));assert.equal(saved.rotationTxn.phase,'RECOVERY_REQUIRED');
});

test('rotation refuses non-FC project before bootstrap side effect',async()=>{
  const adapter=makeAdapter(),cacheDir=tempCache(),active=fakeLive(),project=fakeLive({href:'https://chatgpt.com/g/g-p-wrong/project'}),transport={openActive:async()=>active,openProject:async()=>project};
  await assert.rejects(()=>rotateFc('FC3',{bootstrap:'CALLER BOOTSTRAP EXACT',expectedReceipt:'BOOTSTRAP_READY custom'},{adapter,transport,cacheDir,skipWriterLease:true}),/FC_TOOL_ROTATE_PROJECT_BINDING_INVALID/);assert.equal(project.clicks,0);
});

test('rotation refuses successor conversation outside exact FC project',async()=>{
  const adapter=makeAdapter(),cacheDir=tempCache(),active=fakeLive(),project=fakeLive({href:FC_PROJECT_URL},{assistantText:'BOOTSTRAP_READY custom',realUrl:'https://chatgpt.com/g/g-p-wrong/c/22222222-2222-2222-2222-222222222222'}),transport={openActive:async()=>active,openProject:async()=>project};
  await assert.rejects(()=>rotateFc('FC3',{bootstrap:'CALLER BOOTSTRAP EXACT',expectedReceipt:'BOOTSTRAP_READY custom'},{adapter,transport,cacheDir,skipWriterLease:true}),/FC_TOOL_ROTATE_CONVERSATION_PROJECT_MISMATCH/);
  const saved=JSON.parse(fs.readFileSync(path.join(cacheDir,'fc-tool-fc3-state.json'),'utf8'));assert.equal(saved.rotationTxn.phase,'RECOVERY_REQUIRED');
});

test('authority apply uses prompt fence, exact active readback and ISO wake',async()=>{
  const adapter=makeAdapter(),cacheDir=tempCache(),live=fakeLive();
  const out=await applyFcAuthority('FC3',{expected:{host:'PAP-513',prompt:'old prompt',activeSessionKey:'PAP-900'},desired:{host:'PAP-777',prompt:'caller prompt',nextWakeAt:'2026-10-14T06:00:00+07:00'}},{adapter,transport:{openActive:async()=>live},cacheDir,skipWriterLease:true});
  assert.equal(out.readback.host,'PAP-777');assert.equal(out.readback.prompt,'caller prompt');assert.equal(out.readback.nextWakeAt,'2026-10-13T23:00:00.000Z');assert.equal(out.readback.activeSessionKey,'PAP-900');
  assert.deepEqual(adapter.calls.find(x=>x[0]==='setPrompt'),['setPrompt','FC3',null]);
});

test('authority session drift during fence fails closed and retains recovery requirement',async()=>{
  let raced=false;const adapter=makeAdapter({onSetPrompt:async(state,value)=>{if(value===null&&!raced){raced=true;state.sessions[0].key='PAP-999';}}}),cacheDir=tempCache(),live=fakeLive();
  await assert.rejects(()=>applyFcAuthority('FC3',{expected:{host:'PAP-513',activeSessionKey:'PAP-900'},desired:{host:'PAP-777'}},{adapter,transport:{openActive:async()=>live},cacheDir,skipWriterLease:true}),/FC_TOOL_AUTH_RECOVERY_REQUIRED/);
  const saved=JSON.parse(fs.readFileSync(path.join(cacheDir,'fc-tool-fc3-state.json'),'utf8'));assert.equal(saved.authorityTxn.phase,'RECOVERY_REQUIRED');assert.equal(adapter.state.prompt,null);
});

test('failed authority rollback keeps prompt fenced and durable recovery evidence',async()=>{
  const adapter=makeAdapter({failRestoreHost:true,failDesiredWake:true}),cacheDir=tempCache(),live=fakeLive();
  await assert.rejects(()=>applyFcAuthority('FC3',{expected:{host:'PAP-513',activeSessionKey:'PAP-900'},desired:{host:'PAP-777',nextWakeAt:'2026-10-14T06:00:00+07:00'}},{adapter,transport:{openActive:async()=>live},cacheDir,skipWriterLease:true}),/FC_TOOL_AUTH_RECOVERY_REQUIRED/);
  const saved=JSON.parse(fs.readFileSync(path.join(cacheDir,'fc-tool-fc3-state.json'),'utf8'));assert.equal(saved.authorityTxn.phase,'RECOVERY_REQUIRED');assert.equal(adapter.state.prompt,null);assert.equal(adapter.state.host,'PAP-777');
});

function snapshotPage({bubbleText,targetText,controls=[]}){
  const target={innerText:targetText};
  const controlNodes=controls.map(text=>({innerText:text,getAttribute:name=>name==='aria-label'?text:null}));
  const bubble={innerText:bubbleText,querySelector:selector=>selector==='[data-search-result-target]'?target:null,querySelectorAll:selector=>selector==='button,[role="button"]'?controlNodes:[]};
  const user={innerText:bubbleText,getAttribute:name=>name==='data-chatgpt-search-unit-key'?'turn:user':name==='data-chatgpt-search-message-ids'?'u-new':null,querySelector:selector=>selector==='[data-user-message-bubble="true"]'?bubble:null};
  return {evaluate:async fn=>{const prior={document:globalThis.document,getComputedStyle:globalThis.getComputedStyle,location:globalThis.location};globalThis.document={querySelectorAll:selector=>selector==='[data-chatgpt-search-unit-key][data-chatgpt-search-message-ids]'?[user]:[]};globalThis.getComputedStyle=()=>({display:'block',visibility:'visible'});globalThis.location={href:'https://chatgpt.com/g/g-p-test/c/11111111-1111-1111-1111-111111111111'};user.getBoundingClientRect=()=>({width:1,height:1});try{return fn();}finally{if(prior.document===undefined)delete globalThis.document;else globalThis.document=prior.document;if(prior.getComputedStyle===undefined)delete globalThis.getComputedStyle;else globalThis.getComputedStyle=prior.getComputedStyle;if(prior.location===undefined)delete globalThis.location;else globalThis.location=prior.location;}}};
}

test('modern user snapshot strips only proven collapse chrome',async()=>{
  const snap=await pageSnapshot(snapshotPage({bubbleText:'opaque caller text\n…\nShow more',targetText:'opaque caller text',controls:['Show more']}));
  assert.equal(snap.users[0].text,'opaque caller text');
});

test('literal payload suffix cannot masquerade as collapse chrome',async()=>{
  const snap=await pageSnapshot(snapshotPage({bubbleText:'opaque\nShow more',targetText:'opaque'}));
  assert.equal(snap.users[0].text,'opaque\nShow more');
});
test('partial modern content descendant cannot falsely reconcile exact delivery',async()=>{
  const adapter=makeAdapter(),cacheDir=tempCache(),first=fakeLive();
  const one=await sendFc('FC3','opaque',{operationId:'op-partial',adapter,transport:{openActive:async()=>first},cacheDir,skipWriterLease:true,verifyTimeoutMs:1});
  assert.equal(one.status,'SEND_UNCERTAIN_VERIFY_TIMEOUT');
  const extracted=await pageSnapshot(snapshotPage({bubbleText:'opaque\nadditional user payload',targetText:'opaque'}));
  assert.equal(extracted.users[0].text,'opaque\nadditional user payload');
  const second=fakeLive({users:extracted.users,lastRole:'user'});
  const two=await sendFc('FC3','opaque',{operationId:'op-partial',adapter,transport:{openActive:async()=>second},cacheDir,skipWriterLease:true});
  assert.equal(two.status,'SEND_UNCERTAIN_RECONCILE');assert.equal(second.clicks,0);
});
test('tool source contains no embedded FC strategy vocabulary',()=>{
  const src=fs.readFileSync(new URL('./fc-tool-core.mjs',import.meta.url),'utf8');
  for(const forbidden of ['PAP-507','ACTIVE FC PLAN','ROLE_DEPENDENCY','canonicalPrompt','nextAction']) assert.equal(src.includes(forbidden),false,forbidden);
});
