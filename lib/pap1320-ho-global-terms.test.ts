import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { handleHoGlobalTerms,hasLiveFounder } from "./ho-global-terms-facade";
import { GLOBAL_TERMS_API as base,GLOBAL_TERMS_PERMISSION as permission,parseCoreTermDetail,parseCoreTermList,parseTermCommand } from "./ho-global-terms-contract";
import type { HoGlobalTermWeeksEnv } from "./ho-global-termweeks-read-facade";
import { decideHostBoundary } from "./host-boundary";
import { surfaceSession } from "./workspace-adapters/session";
import { createHoTddAdapter } from "./workspace-adapters";
import { TddRegistry,authorizedTabs,authorizedHostActions } from "./workspace-schema";
import { globalTermDefinition,globalTermProvider,globalTermQuery,verifyGlobalTermApproval } from "../app/ho/operating-cycle/global-terms/schema";
import { loadGlobalTerm,loadGlobalTerms,termRequest } from "./ho-global-terms-client";
import { BoApiError } from "./bo-api-error";

const id="01900000-0000-7000-8000-000000000001",weekId="01900000-0000-7000-8000-000000000002",userId="01900000-0000-7000-8000-000000000003";
const origin="https://ho.staging.pinohouse.art";
const version="2026-11-01T00:00:00.000Z",next="2026-11-01T00:00:00.001Z";
const term={id,displayName:"Global Term",code:"GLOBAL-2026",scopeType:"GLOBAL",centerId:weekId,startDate:"2026-11-01",endDate:"2026-11-30",updatedAt:version};
const week={id:weekId,termId:id,code:"W1",ordinal:1,startDate:"2026-11-01",endDate:"2026-11-07",rhythmKey:"BUILD"};
const detail={...term,weeks:[week],history:[{id:weekId,occurredAt:version,actorId:userId,action:"OPERATING_CYCLE_GLOBAL_TERM_UPDATED",payload:{private:"never expose"}}]};
const grant={roleKey:"founder",roleType:"system",roleStatus:"active",scopeType:"GLOBAL",scopeId:null,effectiveFrom:"2026-01-01T00:00:00.000Z",effectiveUntil:null};
const users=[{id:userId,status:"active",assignments:[grant]}];
const context={userId,email:"founder@example.invalid",surface:"BO",entitled:true,permissionKeys:["team.bo.access",permission]};
function harness(options:{user?:string;users?:unknown;permissions?:string[];core?:(r:{method:string;path:string;body?:unknown;idempotencyKey?:string})=>{status:number;body:unknown}}={}){
  const calls:{method:string;path:string;body?:unknown;idempotencyKey?:string}[]=[];
  const env:HoGlobalTermWeeksEnv={APP_ENV:"staging",HO_PILOT_FOUNDER_USER_IDS:[userId,"manager"].join(","),PINO_BO_CORE:{async executeWithStaffPassword(r,token){assert.equal(token,"test-session");return {status:200,requestId:"auth",body:{data:r.path==="context"?{...context,userId:options.user??userId,permissionKeys:options.permissions??context.permissionKeys}:options.users??users}};}},PINO_WORKFORCE_CORE:{async executePlanningWithStaffPassword(r,token){assert.equal(token,"test-session");calls.push(r);return {...(options.core?.(r)??{status:200,body:{data:r.path.endsWith(id)?detail:[{...term,weekCount:1}]}}),requestId:"test"};}}};
  return {env,calls,send:(suffix="",method="GET",body?:unknown,extra:Record<string,string>={})=>handleHoGlobalTerms(new Request(origin+base+suffix,{method,headers:{host:"ho.staging.pinohouse.art",origin,"content-type":"application/json","idempotency-key":"pap1320-test-001",cookie:"pino_staff_password_session=test-session",...extra},...(body===undefined?{}:{body:JSON.stringify(body)})}),env)};
}
test("PAP-1320 exact list/detail Core facade and redacted projection",async()=>{
  const h=harness();
  const list=await h.send();assert.equal(list.status,200);assert.equal((await list.json()).data[0].weekCount,1);
  const res=await h.send("/"+id);assert.equal(res.status,200);const d=(await res.json()).data;
  assert.equal(d.id,id);assert.equal(d.name,term.displayName);assert.equal(d.weeks[0].termId,id);
  assert.equal("centerId" in d,false);assert.equal("payload" in d.history[0],false);
  assert.deepEqual(h.calls.map(c=>[c.method,c.path]),[["GET","global-terms/ho"],["GET","global-terms/ho/"+id]]);
  assert.equal(res.headers.get("cache-control"),"no-store");
});
test("PAP-1320 BFF rejects anonymous, Manager even pilot-listed+granted, missing permission, expired Founder",async()=>{
  for(const options of [{user:"manager"},{permissions:["team.bo.access"]},{users:[{id:userId,status:"active",assignments:[{...grant,effectiveUntil:version}]}]}]){
    const h=harness(options);assert.equal((await h.send()).status,403);assert.equal((await h.send("/"+id+"/update","POST",{displayName:"Rename",expectedUpdatedAt:version})).status,403);assert.equal(h.calls.length,0);
  }
  const h=harness();assert.equal((await h.send("","GET",undefined,{cookie:""})).status,401);assert.equal(h.calls.length,0);
  for(const invalid of [{...grant,roleType:"custom"},{...grant,roleStatus:"archived"},{...grant,scopeType:"CENTER"},{...grant,effectiveFrom:"2999-01-01"},{...grant,effectiveUntil:"invalid"}])assert.equal(hasLiveFounder([{id:userId,status:"active",assignments:[invalid]}],userId),false);
});
test("PAP-1320 wrong host, origin, verb, query, paths denied before Core",async()=>{
  for(const host of ["bo.staging.pinohouse.art","tos.staging.pinohouse.art","ho.pinohouse.art","localhost"]){
    for(const path of [base,base+"/"+id,base+"/"+id+"/update",base+"/"+id+"/delete"]){assert.equal(decideHostBoundary(host,path,"POST").action,"not_found");}
    const h=harness();assert.equal((await h.send("","GET",undefined,{host})).status,404);assert.equal(h.calls.length,0);
  }
  for(const [suffix,method] of [["/","GET"],["?centerId="+id,"GET"],["/"+id+"/update","GET"],["/"+id,"POST"],["/not-a-uuid","GET"],["","DELETE"]]){const h=harness();assert.equal((await h.send(suffix,method)).status,404);assert.equal(h.calls.length,0);}
  for(const extra of ([{origin:"https://evil.invalid"},{"content-type":"text/plain"},{"idempotency-key":""}] as Record<string,string>[])){const h=harness();assert.ok([400,403].includes((await h.send("","POST",{},extra)).status));assert.equal(h.calls.length,0);}
  const h=harness();h.env.APP_ENV="production";assert.equal((await h.send()).status,404);
});
test("PAP-1320 strict commands and canonical data fail closed",()=>{
  const valid={displayName:"Term",code:"G-2026",startDate:"2026-11-01",endDate:"2026-11-30"};
  assert.deepEqual(parseTermCommand(valid,"create"),valid);
  assert.deepEqual(parseTermCommand({displayName:"Rename",expectedUpdatedAt:version},"update"),{displayName:"Rename",expectedUpdatedAt:version});
  for(const b of [{...valid,centerId:id},{...valid,scopeType:"GLOBAL"},{...valid,startDate:"2026-02-30"},{...valid,endDate:"2026-01-01"},{...valid,status:"ACTIVE"}])assert.equal(parseTermCommand(b,"create"),null);
  assert.equal(parseTermCommand({displayName:"Rename"},"update"),null);
  assert.equal(parseCoreTermList({data:[{...term,scopeType:"CENTER",weekCount:0}]}),null);
  assert.equal(parseCoreTermList({data:[term]}),null);
  assert.equal(parseCoreTermDetail({data:{...detail,weeks:[{...week,termId:weekId}]}}),null);
  assert.equal(parseCoreTermDetail({data:{...detail,weeks:[{...week,startDate:"2026-02-30"}]}}),null);
});
test("PAP-1320 forwards 401/403/404/409/503 without fake data or write retries",async()=>{
  for(const status of [401,403,404,409,503]){const h=harness({core:()=>({status,body:{error:{code:"CORE_CONFLICT",private:"hidden"}}})});const res=await h.send("/"+id+"/update","POST",{displayName:"Rename",expectedUpdatedAt:version});assert.equal(res.status,status);assert.equal(h.calls.length,1);assert.equal((await res.json()).error.private,undefined);}
});
test("PAP-1320 Create and Update require receipt plus matching detail readback",async()=>{
  for(const action of ["create","update"] as const){const input=action==="create"?{displayName:"Rename",code:term.code,startDate:term.startDate,endDate:term.endDate}:{displayName:"Rename",expectedUpdatedAt:version};
    const changed={...term,displayName:"Rename",updatedAt:next};
    const h=harness({core:r=>({status:r.method==="POST"?(action==="create"?201:200):200,body:{data:r.method==="POST"?changed:{...changed,weeks:[week],history:[]}}})});
    assert.equal((await h.send(action==="create"?"":"/"+id+"/update","POST",input)).status,action==="create"?201:200);
    assert.equal(h.calls.length,2);assert.equal(h.calls[0]!.idempotencyKey,"pap1320-test-001");assert.deepEqual(h.calls[0]!.body,input);
  }
  for(const core of [()=>({status:200,body:{data:{}}}),()=>({status:204,body:{}}),r=>({status:200,body:{data:r.method==="POST"?{...term,displayName:"Rename",updatedAt:next}:detail}})] satisfies NonNullable<Parameters<typeof harness>[0]>["core"][]){
    const h=harness({core});assert.equal((await h.send("/"+id+"/update","POST",{displayName:"Rename",expectedUpdatedAt:version})).status,502);
  }
});
test("PAP-1320 Delete only succeeds with explicit receipt and Core 404 readback",async()=>{
  for(const readStatus of [200,404,503]){const h=harness({core:r=>r.method==="POST"?{status:200,body:{data:{termId:id,deleted:true,centerId:weekId}}}:{status:readStatus,body:{}}});const res=await h.send("/"+id+"/delete","POST",{expectedUpdatedAt:version});assert.equal(res.status,readStatus===404?200:502);if(res.status===200)assert.deepEqual(await res.json(),{data:{termId:id,deleted:true}});}
});
test("PAP-1320 authenticated network harness exercises typed TDD list/detail/history and slot wiring",async()=>{
  const h=harness();const fetcher:typeof fetch=async(input,init)=>{const url=new URL(String(input),origin);if(url.pathname==="/api/bo/context")return Response.json({data:context});return h.send(url.pathname.slice(base.length),init?.method??"GET");};
  const controller=new AbortController();const adapter=await createHoTddAdapter({origin,fetcher,registry:new TddRegistry(verifyGlobalTermApproval),definition:globalTermDefinition,provider:globalTermProvider},controller.signal);
  try{const list=await adapter.list(globalTermQuery,controller.signal);assert.equal(list.rows[0]?.weekCount,1);assert.equal((await adapter.detail(id,controller.signal))?.version,version);
    assert.deepEqual(authorizedTabs(adapter.schema,adapter.context,list.rows[0]).map(t=>t.id),["overview","weeks","history"]);
    assert.equal(authorizedHostActions(adapter.schema,adapter.context,"table.header",{"term.create":{run(){}}}).length,1);
    assert.equal(authorizedHostActions(adapter.schema,adapter.context,"detail.header",{"term.edit":{run(){}},"term.delete":{run(){}}}).length,2);
    const history=await adapter.history({id,type:"term"},controller.signal);assert.equal(history.status,"authorized");if(history.status==="authorized"){assert.equal(history.events.length,1);assert.equal(history.events[0]?.redacted,true);}
  }finally{adapter.dispose();}
});
test("PAP-1320 surface transport admits only exact GET/POST routes and same origin",async()=>{
  let calls=0;const session=surfaceSession("HO",origin,async()=>{calls++;return Response.json({data:[]});});
  for(const [path,method] of [[base,"GET"],[base,"POST"],[base+"/"+id,"GET"],[base+"/"+id+"/update","POST"],[base+"/"+id+"/delete","POST"]])assert.equal((await session.transport(path,{method})).status,200);
  assert.equal(calls,5);
  for(const [path,method] of [[base+"?centerId="+id,"GET"],[base+"/","GET"],[base+"/"+id,"POST"],[base,"DELETE"],["/api/bo/centers","POST"],["/api/ho/workforce/global-termweeks","POST"],["https://evil.invalid"+base,"POST"],[base+"/"+id+"/delete/extra","POST"]])await assert.rejects(session.transport(path,{method}),e=>e instanceof BoApiError&&e.status===404);
  session.dispose();
});
test("PAP-1320 client propagates 409/invalid detail and never substitutes fake data",async()=>{
  for(const status of [401,403,404,409,503])await assert.rejects(loadGlobalTerms(async()=>Response.json({}, {status}),new AbortController().signal),e=>e instanceof BoApiError&&e.status===status);
  await assert.rejects(loadGlobalTerm(id,async()=>Response.json({data:{}}),new AbortController().signal),e=>e instanceof BoApiError&&e.status===502);
  await assert.rejects(termRequest("/"+id+"/update",{method:"POST"},async()=>Response.json({}, {status:409})),/Tải lại/);
});
test("PAP-1320 reachable module uses shared slots, editor and real week navigation",()=>{
  const source=readFileSync("app/ho/operating-cycle/global-terms/HoGlobalTermsTdd.tsx","utf8"),editor=readFileSync("app/ho/operating-cycle/global-terms/HoGlobalTermEditor.tsx","utf8");
  assert.match(source,/<SurfaceWorkspace/);assert.match(source,/module="globalTerms"/);assert.match(source,/\/ho\/workforce\/term-weeks\?record=/);assert.match(editor,/<DrawerFrame/);assert.match(editor,/Core chưa cung cấp xác nhận an toàn/);
  assert.doesNotMatch(source+editor,/localStorage|querySelector|innerHTML|previewRows/);
});
