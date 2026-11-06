import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {runInNewContext} from 'node:vm';
const source=readFileSync('lib/bo-self-loadout-handler.ts','utf8');
const handler=stripTypeScriptTypes(source.replace(/^import .*;$/gm,'').replace(/export /g,''));
const center='01a0b29a-3acd-7a18-a0f2-cf6016548ab5', self='01a18140-10b8-70d3-ad6b-3e747a0cddea';
const root=`pinoria/selfs/${self}/set`;
function fixture(status=200){
 const seen=[];
 class TeamAuthError extends Error{}
 const context={Request,Response,URL,Buffer,console,TeamAuthError,teamCredential:async()=>({kind:'password',token:'private-session'}),callBoAccessCoreWithCredential:async(_binding,request)=>{seen.push(request);return {status,body:status===200?{data:{selfId:self}}:{error:{code:'DENIED'}},requestId:'request'};}};
 runInNewContext(handler+';globalThis.handle=handleBoSelfLoadoutRequest;',context);
 const send=(suffix='',method='GET',body,query=`centerId=${center}`,headers={})=>context.handle(new Request(`https://bo.staging.pinohouse.art/api/bo/${root}${suffix}?${query}`,{method,headers:{'content-type':'application/json','idempotency-key':'test-key-123',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})}),{},root+suffix);
 return {seen,send};
}
const clear={expectedVersion:0,expectedSelfVersion:1,reason:' clear '};
test('Starter sends canonical Item, Center, CAS, reason and replay key without actor identity',async()=>{
 const f=fixture();
 const request={...clear,setItemId:self};
 assert.equal((await f.send('/starter','POST',request)).status,200);
 assert.deepEqual(JSON.parse(JSON.stringify(f.seen[0])),{
   method:'POST',path:root+'/starter',resource:{centerId:center},
   body:{expectedVersion:0,expectedSelfVersion:1,reason:'clear',setItemId:self},
   idempotencyKey:'test-key-123',
 });
 assert.doesNotMatch(JSON.stringify(f.seen),/private-session|email|actor/);
 assert.equal((await f.send('/starter','GET')).status,405);
 assert.equal((await f.send('/starter','POST',clear)).status,400);
 assert.equal((await f.send('/starter','POST',{...clear,setItemId:'invalid'})).status,400);
 assert.equal((await f.send('/starter','POST',{...request,actor:'founder'})).status,400);
 assert.equal(f.seen.length,1);
});
test('Starter UI uses one-time server eligibility and checks readback before success',()=>{
 const ui=readFileSync('app/bo/pinoria-avatars/SelfLoadoutDetail.tsx','utf8');
 assert.match(ui,/starterAvailable:boolean; starterSets:EligibleSet\[\]/);
 assert.match(ui,/selfSet\?\.starterSets\.find\(s=>s\.setItemId===selectedStarterId\)/);
 assert.match(ui,/set\/starter\?centerId=/);
 assert.match(ui,/next\.setItemId!==choice\.setItemId \|\| next\.starterAvailable/);
 assert.match(ui,/id="self-loadout-starter"/);
 assert.match(ui,/>Nhận Starter<\/button>/);
 assert.match(ui,/!selfSet\.starterSets\.some/);
 assert.match(ui,/setSelectedStarterId\(""\);setActiveSetError/);
});
test('Set media facade only forwards bounded authorized member index and rejects malformed binary',async()=>{
 const f=fixture();
 assert.equal((await f.send('/media/0','GET')).status,502);
 assert.equal(f.seen[0].path,root+'/media/0');
 assert.deepEqual(JSON.parse(JSON.stringify(f.seen[0].resource)),{centerId:center});
 assert.equal((await f.send('/media/0','POST',clear)).status,405);
 assert.equal((await f.send('/media/8','GET')).status,404);
 assert.equal((await f.send('/media/-1','GET')).status,404);
 assert.equal((await f.send('/media/0','GET',undefined,'centerId=forged')).status,400);
 assert.equal(f.seen.length,1);
});
test('Set full-frame preview is scoped to Set media and never shows underlying base slots',()=>{
 const ui=readFileSync('app/bo/pinoria-avatars/SelfLoadoutDetail.tsx','utf8');
 const renderer=readFileSync('app/components/pinoria/SelfLoadoutPreview.tsx','utf8');
 assert.match(ui,/set\/media\/"\+index/);
 assert.match(ui,/activeSet=\{selfSet\?\.setItemId\?selfSet:null\}/);
 assert.doesNotMatch(ui,/Chưa thể hiển thị hình ảnh Set này/);
 assert.match(renderer,/new OffscreenCanvas\(WIDTH,HEIGHT\)/);
 assert.match(renderer,/painter\.fillRect\(0,0,WIDTH,HEIGHT\)/);
 assert.match(renderer,/const img=await imageFrom\(url,ctl\.signal\)/);
 assert.match(renderer,/ctx\.drawImage\(backing,0,0,WIDTH,HEIGHT\)/);
 assert.match(renderer,/setMissing\(\["SET"\]\)/);
});
test('Set GET is read-only; commands forward exact Center/CAS/key without identity data',async()=>{
 const f=fixture();assert.equal((await f.send()).status,200);
 assert.deepEqual(JSON.parse(JSON.stringify(f.seen[0])),{method:'GET',path:root,resource:{centerId:center}});
 for(const suffix of ['/clear','/apply'])assert.equal((await f.send(suffix,'POST',{...clear,...(suffix==='/apply'?{setItemId:self}:{})})).status,200);
 assert.equal(f.seen[1].body.reason,'clear');assert.equal(f.seen[1].idempotencyKey,'test-key-123');
 assert.doesNotMatch(JSON.stringify(f.seen),/private-session|email|actor/);
});
test('Set rejects wrong methods, malformed scope/body/content/key before Core',async()=>{
 const f=fixture();
 for(const [suffix,method] of [['','POST'],['/apply','GET'],['/clear','GET'],['/clear','DELETE']])assert.equal((await f.send(suffix,method)).status,405);
 for(const query of ['',`centerId=${center}&centerId=${center}`,'centerId=forged',`centerId=${center}&actor=admin`])assert.equal((await f.send('','GET',undefined,query)).status,400);
 for(const body of [{...clear,actor:'admin'},{...clear,expectedSelfVersion:0},{...clear,expectedVersion:-1},{...clear,reason:' '},{...clear,reason:'x'.repeat(1001)},{...clear,expectedVersion:0.5},[]])assert.equal((await f.send('/clear','POST',body)).status,400);
 assert.equal((await f.send('/apply','POST',clear)).status,400);
 assert.equal((await f.send('/clear','POST',clear,undefined,{'content-type':'application/jsonp'})).status,400);
 assert.equal((await f.send('/clear','POST',clear,undefined,{'idempotency-key':''})).status,400);
 assert.equal(f.seen.length,0);
});
for(const status of [400,403,404,409])test(`Core ${status} passes through without PII`,async()=>{
 const response=await fixture(status).send('/clear','POST',clear);
 assert.equal(response.status,status);assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual(await response.json(),{error:{code:'DENIED'}});
});
test('UI Set-first, Core eligible Apply and Clear with CAS readback and fail-closed media',()=>{
 const ui=readFileSync('app/bo/pinoria-avatars/SelfLoadoutDetail.tsx','utf8');
 assert.ok(ui.indexOf('id="self-loadout-set"')<ui.indexOf('options.map'));
 assert.match(ui,/expectedSelfVersion:selfSet.selfVersion/);assert.match(ui,/setConflict\(true\)/i);
 assert.match(ui,/loadout=\{selfSet && !selfSet.setItemId\?loadout:null\}/);
 assert.match(ui,/expectedVersion:loadout.version,itemIdsBySlot:chosen,reason:reason.trim\(\)/);
 assert.doesNotMatch(ui,/>[^<]*(?:S6|demo|fixture)/);
 assert.match(ui,/set\/apply\?/);
 assert.match(ui,/eligibleSets\.find/);
 assert.match(ui,/if\(next.setItemId!==requestedSetId\)/);
 assert.match(ui,/\!Array.isArray\(d.eligibleSets\)/);
 assert.doesNotMatch(ui,/starter\/grant/);
 const preview=readFileSync('app/components/pinoria/SelfLoadoutPreview.tsx','utf8');assert.match(preview,/if\(!loadout&&!activeSet\).*clearRect/);
});
