import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { observeFc, sendFc, rotateFc, applyFcAuthority } from './fc-tool-core.mjs';

function tempCache(){return fs.mkdtempSync(path.join(os.tmpdir(),'fc-tools-'));}
function makeAdapter(){
  const calls=[];
  const state={slot:'FC3',key:'PAP-174',cdpPort:9337,mode:'FC',host:'PAP-513',prompt:'old prompt',nextWakeAt:null,sessions:[{key:'PAP-900',summary:'session',status:'In Progress',description:'https://chatgpt.com/g/g-p-test/c/11111111-1111-1111-1111-111111111111',parent:'PAP-174'}]};
  const clone=x=>JSON.parse(JSON.stringify(x));
  return {
    calls,state,validConversationUrl:v=>String(v).includes('/c/'),
    async readSlot(){return clone(state);},
    async readSession(key){return clone(state.sessions.find(x=>x.key===key));},
    async createStagedSession(slot,host,url){calls.push(['createStagedSession',slot,host,url]);const x={key:'PAP-901',summary:'staged',status:'To Do',description:url,parent:'PAP-174'};state.sessions.push(x);return {slot,bearer:'PAP-174',host,session:x.key,status:'To Do',url};},
    async activateSession(slot,key,host){calls.push(['activateSession',slot,key,host]);for(const s of state.sessions)s.status=s.key===key?'In Progress':'Done';state.host=host;return {slot,session:key,host,url:state.sessions.find(x=>x.key===key).description};},
    async transitionIssue(key,status){calls.push(['transitionIssue',key,status]);const x=state.sessions.find(s=>s.key===key);if(x)x.status=status;return {key,status};},
    async setHost(slot,value){calls.push(['setHost',slot,value]);state.host=value;return {slot,host:value};},
    async setPrompt(slot,value){calls.push(['setPrompt',slot,value]);state.prompt=value;return {slot,prompt:value};},
    async setNextWakeAt(slot,value){calls.push(['setNextWakeAt',slot,value]);state.nextWakeAt=value==null?null:new Date(value).toISOString();return {slot,nextWakeAt:state.nextWakeAt};},
  };
}
function fakeLive(initial={}){
  let typed='', clicks=0;
  const snap={href:'https://chatgpt.com/g/g-p-test/c/11111111-1111-1111-1111-111111111111',busy:false,users:[],assistants:[{id:'a1',text:'done'}],lastRole:'assistant',composerVisible:true,...initial};
  return {get typed(){return typed},get clicks(){return clicks},snapshot:async()=>JSON.parse(JSON.stringify(snap)),composerText:async()=>'',type:async t=>{typed=t},clickSend:async()=>{clicks++},waitUserText:async()=>null,waitRealUrl:async()=> 'https://chatgpt.com/g/g-p-test/c/22222222-2222-2222-2222-222222222222',waitAssistantStable:async()=> 'BOOTSTRAP_READY custom',close:async()=>{},closePage:async()=>{},url:()=>snap.href,_snap:snap};
}

test('observe returns factual state only',async()=>{
  const adapter=makeAdapter(),live=fakeLive();
  const out=await observeFc('FC3',{adapter,transport:{openActive:async()=>live},cacheDir:tempCache(),skipLegacyLease:true});
  assert.equal(out.tool,'fc.observe');assert.equal(out.host,'PAP-513');assert.equal(out.activeSession.key,'PAP-900');assert.equal(out.conversation.lastRole,'assistant');
});

test('send reconciles uncertain accepted delivery without duplicate click',async()=>{
  const adapter=makeAdapter(),cacheDir=tempCache(),first=fakeLive();
  const transport1={openActive:async()=>first};
  const one=await sendFc('FC3','opaque caller text',{adapter,transport:transport1,cacheDir,skipLegacyLease:true,verifyTimeoutMs:1});
  assert.equal(one.status,'SEND_UNCERTAIN_VERIFY_TIMEOUT');assert.equal(first.clicks,1);
  const second=fakeLive({users:[{id:'u2',text:'opaque caller text'}],lastRole:'user'});
  const two=await sendFc('FC3','opaque caller text',{adapter,transport:{openActive:async()=>second},cacheDir,skipLegacyLease:true});
  assert.equal(two.status,'SEND_RECONCILED_ACCEPTED');assert.equal(second.clicks,0);
});

test('rotate sends caller bootstrap exactly and activates only after exact receipt',async()=>{
  const adapter=makeAdapter(),cacheDir=tempCache(),live=fakeLive();
  const out=await rotateFc('FC3',{bootstrap:'CALLER BOOTSTRAP EXACT',expectedReceipt:'BOOTSTRAP_READY custom'},{adapter,transport:{openProject:async()=>live},cacheDir,skipLegacyLease:true});
  assert.equal(live.typed,'CALLER BOOTSTRAP EXACT');assert.equal(live.clicks,1);assert.equal(out.successor,'PAP-901');assert.equal(adapter.state.sessions.find(x=>x.key==='PAP-901').status,'In Progress');
  assert.deepEqual(adapter.calls.filter(x=>x[0]==='activateSession').length,1);
});

test('authority apply uses caller desired values, prompt fence and ISO wake readback',async()=>{
  const adapter=makeAdapter(),cacheDir=tempCache(),live=fakeLive();
  const out=await applyFcAuthority('FC3',{expected:{host:'PAP-513',prompt:'old prompt',activeSessionKey:'PAP-900'},desired:{host:'PAP-777',prompt:'caller prompt',nextWakeAt:'2026-10-14T06:00:00+07:00'}},{adapter,transport:{openActive:async()=>live},cacheDir,skipLegacyLease:true});
  assert.equal(out.readback.host,'PAP-777');assert.equal(out.readback.prompt,'caller prompt');assert.equal(out.readback.nextWakeAt,'2026-10-13T23:00:00.000Z');
  assert.deepEqual(adapter.calls.find(x=>x[0]==='setPrompt'),['setPrompt','FC3',null]);
  assert.ok(!adapter.calls.some(x=>JSON.stringify(x).includes('canonicalPrompt')));
});

test('tool source contains no embedded FC strategy vocabulary',()=>{
  const src=fs.readFileSync(new URL('./fc-tool-core.mjs',import.meta.url),'utf8');
  for(const forbidden of ['PAP-507','ACTIVE FC PLAN','ROLE_DEPENDENCY','canonicalPrompt','nextAction']) assert.equal(src.includes(forbidden),false,forbidden);
});
