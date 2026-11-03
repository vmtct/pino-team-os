import {loadHistory} from './workspace-schema';
import {termWeekProvider} from '../app/ho/workforce/term-weeks/schema';
import test from 'node:test';import assert from 'node:assert/strict';
import {handleHoTermWeek} from './ho-termweek-facade';
import {handleHoGlobalWeekLock} from './ho-global-week-lock-facade';
import {hasLiveFounder} from './ho-global-terms-facade';
import {parseWeekCommand,parseWeekDetail,parseWeekList,WEEK_API as base,WEEK_PERMISSION as permission} from './ho-termweek-contract';
import type {HoGlobalTermWeeksEnv} from './ho-global-termweeks-read-facade';
import {decideHostBoundary} from './host-boundary';
import {surfaceSession} from './workspace-adapters/session';
import {termWeekDefinition,termWeekInitialQuery,termWeekSchema} from '../app/ho/workforce/term-weeks/schema';
const id='01900000-0000-7000-8000-000000000001',termId='01900000-0000-7000-8000-000000000002',userId='01900000-0000-7000-8000-000000000003';
const origin='https://ho.staging.pinohouse.art',version='2026-11-01T00:00:00.000Z',next='2026-11-01T00:00:00.001Z';
const parent={id:termId,displayName:'Global Term',scopeType:'GLOBAL',startDate:'2026-11-01',endDate:'2026-11-30'};
const week={id,termId,code:'W1',ordinal:1,startDate:'2026-11-01',endDate:'2026-11-07',rhythmKey:'BUILD',createdAt:version,updatedAt:version,global_week_registration_locked:false,lockVersion:0,referenceCount:0,deletionEligible:true};
const detail={...week,parent,history:[{id,occurredAt:version,actorId:userId,action:'OPERATING_CYCLE_TERM_WEEK_UPDATED',payload:{actorEmail:'private@pino.invalid',reason:'Correct rhythm',before:{rhythmKey:'OPENING'},after:{rhythmKey:'BUILD'}}}]};
const input={termId,code:'W1',ordinal:1,startDate:week.startDate,endDate:week.endDate,rhythmKey:'BUILD',reason:'Create week'};
const grant={roleKey:'founder',roleType:'system',roleStatus:'active',scopeType:'GLOBAL',scopeId:null,effectiveFrom:'2026-01-01T00:00:00.000Z',effectiveUntil:null};
const users=[{id:userId,status:'active',assignments:[grant]}];
type Call={method:string;path:string;body?:unknown;idempotencyKey?:string};
function harness(options:{user?:string;users?:unknown;permissions?:string[];core?:(r:Call)=>{status:number;body:unknown}}={}){
 const calls:Call[]=[];const env:HoGlobalTermWeeksEnv={APP_ENV:'staging',HO_PILOT_FOUNDER_USER_IDS:[userId,'manager','staff'].join(','),PINO_BO_CORE:{async executeWithStaffPassword(r){const user=options.user??userId;return {status:r.path==='ho/admission'&&!hasLiveFounder(options.users??users,user)?403:200,requestId:'auth',body:{data:r.path==='ho/admission'?{admitted:hasLiveFounder(options.users??users,user)}:r.path==='context'?{surface:'BO',entitled:true,email:'founder@pino.invalid',userId:user,permissionKeys:options.permissions??['team.bo.access',permission,'operating_cycle.global_week.lock']}:options.users??users}};}},PINO_WORKFORCE_CORE:{async executePlanningWithStaffPassword(r,token){assert.equal(token,'test-session');calls.push(r);return {...(options.core?.(r)??{status:200,body:{data:r.path==='global-weeks/ho'?{terms:[parent],termWeeks:[week]}:detail}}),requestId:'core'};}}};
 const send=(suffix='',method='GET',body?:unknown,extra:Record<string,string>={})=>handleHoTermWeek(new Request(origin+base+suffix,{method,headers:{host:'ho.staging.pinohouse.art',origin,'content-type':'application/json','idempotency-key':'pap1373-test-key',cookie:'pino_staff_password_session=test-session',...extra},...(body===undefined?{}:{body:JSON.stringify(body)})}),env);return {env,calls,send};
}
test('PAP-1373 canonical list/detail/history, lock/reference projection and payload redaction',async()=>{
 const h=harness();assert.equal((await h.send()).status,200);const result=await h.send('/'+id);assert.equal(result.status,200);const d=(await result.json()).data;
 assert.equal(d.name,'Global Term · W1');assert.equal(d.global_week_registration_locked,false);assert.equal(d.deletionEligible,true);assert.equal(d.history[0].reason,'Correct rhythm');assert.equal(JSON.stringify(d).includes('private@'),false);assert.deepEqual(d.history[0].changes[0],{field:'rhythmKey',before:'OPENING',after:'BUILD'});
 assert.deepEqual(h.calls.map(r=>r.path),['global-weeks/ho','global-weeks/ho/'+id]);assert.equal(result.headers.get('cache-control'),'no-store');
 assert.equal(parseWeekList({data:{terms:[{...parent,scopeType:'CENTER'}],termWeeks:[week]}}),null);
 assert.equal(parseWeekDetail({data:{...detail,parent:{...parent,id}}}),null);
});
test('PAP-1373 exact command validation rejects spoofed scope/identity and invalid calendar/rhythm/CAS',()=>{
 assert.deepEqual(parseWeekCommand(input,'create'),input);
 for(const bad of [{...input,id},{...input,scopeType:'GLOBAL'},{...input,centerId:id},{...input,startDate:'2026-02-30'},{...input,endDate:'2026-10-01'},{...input,ordinal:0},{...input,rhythmKey:'bad value'},{...input,reason:''}])assert.equal(parseWeekCommand(bad,'create'),null);
 assert.equal(parseWeekCommand({expectedUpdatedAt:version,reason:'Delete'},'delete')?.reason,'Delete');assert.equal(parseWeekCommand({expectedUpdatedAt:'stale',reason:'Delete'},'delete'),null);
});
test('PAP-1373 Founder-only server boundary denies Manager/Staff even pilot-listed and permission-granted',async()=>{
 for(const options of [{user:'manager'},{user:'staff'},{permissions:['team.bo.access']},{users:[{id:userId,status:'active',assignments:[{...grant,roleType:'custom'}]}]}]){const h=harness(options);assert.equal((await h.send()).status,403);assert.equal((await h.send('/'+id+'/delete','POST',{expectedUpdatedAt:version,reason:'Delete'})).status,403);assert.equal(h.calls.length,0);}
 const h=harness();assert.equal((await h.send('','GET',undefined,{cookie:''})).status,401);assert.equal(h.calls.length,0);
});
test('PAP-1373 exact host/method/origin/query/idempotency guards fail before Core',async()=>{
 for(const host of ['bo.staging.pinohouse.art','tos.staging.pinohouse.art','ho.pinohouse.art','localhost'])for(const suffix of ['', '/'+id,'/'+id+'/update','/'+id+'/delete']){const h=harness();assert.equal((await h.send(suffix,'GET',undefined,{host})).status,404);assert.equal(h.calls.length,0);assert.equal(decideHostBoundary(host,base+suffix,'POST').action,'not_found');}
 for(const suffix of ['/', '/not-uuid','/'+id+'/unexpected'])assert.equal((await harness().send(suffix)).status,404);
 for(const suffix of ['?centerId='+id,'?unexpected=1','/'+id+'?catalog=1'])assert.equal((await harness().send(suffix)).status,400);
 assert.equal((await harness().send('','POST',input,{origin:'https://evil.invalid'})).status,403);
 assert.equal((await harness().send('','POST',input,{'idempotency-key':''})).status,400);
 const h=harness();h.env.APP_ENV='production';assert.equal((await h.send()).status,404);
});
test('PAP-1373 Create/Edit/Delete require exact receipt and authoritative readback',async()=>{
 for(const action of ['create','update'] as const){const saved={...week,updatedAt:next};const h=harness({core:r=>r.method==='POST'?{status:action==='create'?201:200,body:{data:saved}}:{status:200,body:{data:{...detail,...saved}}}});
 const body=action==='create'?input:{code:'W1',ordinal:1,startDate:week.startDate,endDate:week.endDate,rhythmKey:'BUILD',expectedUpdatedAt:version,reason:'Edit'};
 const result=await h.send(action==='create'?'':'/'+id+'/update','POST',body);assert.equal(result.status,action==='create'?201:200);assert.equal(h.calls.length,2);assert.equal(h.calls[0]?.idempotencyKey,'pap1373-test-key');}
 const deleted=harness({core:r=>r.method==='POST'?{status:200,body:{data:{termWeekId:id,deleted:true}}}:{status:404,body:{error:{code:'NOT_FOUND'}}}});assert.equal((await deleted.send('/'+id+'/delete','POST',{expectedUpdatedAt:version,reason:'Delete'})).status,200);
 const mismatch=harness({core:()=>({status:200,body:{data:{...detail,id:termId}}})});assert.equal((await mismatch.send('/'+id)).status,502);
});
test('PAP-1373 forwards 401/403/404/409/503 honestly and redacts error details',async()=>{
 for(const status of [401,403,404,409,503]){const h=harness({core:()=>({status,body:{error:{code:'CORE_CONFLICT',private:'hidden'}}})});const r=await h.send('/'+id+'/delete','POST',{expectedUpdatedAt:version,reason:'Delete'});assert.equal(r.status,status);assert.equal(h.calls.length,1);assert.equal((await r.json()).error.private,undefined);}
});
test('PAP-1373 registered TDD actions and domain tab preserve system overview/history',()=>{
 assert.equal(termWeekSchema.classification,'TDD_DEFAULT');assert.equal(termWeekDefinition.group,'Operating Cycle');
 for(const handler of ['week.create','week.update','week.delete','week.lock','week.parent'])assert.ok(termWeekDefinition.actions.some(a=>a.handler===handler));
 assert.equal(termWeekDefinition.actions.filter(a=>a.slot==='table.header').length,1);assert.ok(termWeekDefinition.actions.some(a=>a.slot==='drawer.header'&&a.handler==='week.parent'));
 assert.deepEqual(termWeekInitialQuery(termId).filters.rules,[{field:'termId',op:'eq',value:termId}]);
});
test('PAP-1373 authenticated session admits only scoped TermWeek routes, not arbitrary HO writes',async()=>{
 const session=surfaceSession('HO',origin,async()=>Response.json({data:[]}));try{
 for(const [p,method] of [[base,'GET'],[base+'?catalog=1','GET'],[base+'/'+id,'GET'],[base,'POST'],[base+'/'+id+'/update','POST'],[base+'/'+id+'/delete','POST'],['/api/ho/workforce/global-week-registration','POST']])assert.equal((await session.transport(p!,{method})).status,200);
 for(const p of [base+'?centerId='+id,base+'/'+id+'?catalog=1',base+'/not-uuid','/api/ho/unregistered'])await assert.rejects(session.transport(p,{method:'GET'}));
 }finally{session.dispose();}
});
test('PAP-1373 real lock facade verifies ON/OFF CAS receipt and readback',async()=>{
 for(const locked of [true,false]){const h=harness({core:()=>({status:200,body:{data:{termWeekId:id,locked,version:5}}})});const request=new Request(origin+'/api/ho/workforce/global-week-registration',{method:'POST',headers:{host:'ho.staging.pinohouse.art',origin,'content-type':'application/json','idempotency-key':'pap1373-lock-key',cookie:'pino_staff_password_session=test-session'},body:JSON.stringify({termWeekId:id,locked,expectedVersion:4,reason:'Founder control'})});assert.equal((await handleHoGlobalWeekLock(request,h.env)).status,200);assert.equal(h.calls.length,2);}
});

test('PAP-1373 populated History passes shared-engine typed diff validation including reason',async()=>{
 const data=parseWeekDetail({data:detail});assert.ok(data);
 const binding=termWeekProvider.history!.bind(async()=>Response.json({data}),{surface:'HO'} as never);
 const schema={...termWeekSchema,detail:{...termWeekSchema.detail,history:binding}};
 const result=await loadHistory(schema as unknown as Parameters<typeof loadHistory>[0],{id,type:'term_week'},{surface:'HO',authorize:()=>true},new AbortController().signal);
 assert.equal(result.status,'authorized');if(result.status==='authorized')assert.deepEqual(result.events[0]?.changes?.at(-1),{field:'auditReason',before:null,after:'Correct rhythm'});
});
