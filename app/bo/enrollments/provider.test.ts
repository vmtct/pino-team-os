import test from "node:test";
import assert from "node:assert/strict";
import {enrollmentProvider} from "./provider";
import {queryDefault,definition,enrollmentSchema,canonicalEnrollmentSchema,READ} from "./schema";
import {surfaceSession} from "@/lib/workspace-adapters/session";
import {bindSurface} from "@/lib/workspace-adapters/adapter";
import {TddRegistry} from "@/lib/workspace-schema";
const id=(n:number)=>"019d2181-0000-7000-8000-"+String(n).padStart(12,"0");
const centerId=id(100),scope={surface:"BO" as const,centerId},record={id:id(1),subscriptionId:id(2),studentProfileId:id(3),runningClassId:id(4),studentDisplayName:"Synthetic learner",subscriptionDisplayName:"Piano",runningClassName:"Piano",pathDisplayName:"Piano",effectiveFromLocalDate:"2026-11-01",effectiveUntilExclusiveLocalDate:null,weekdayIso:3,scheduleStartsLocal:"12:30",scheduleEndsLocal:"13:15"};
test("PAP-2181 provider rereads authorized directory for detail, removes missing relations and exposes no write",async()=>{
 const state=enrollmentProvider(),signal=new AbortController().signal;
 let reads=0;
 const fetcher:typeof fetch=async(input,init)=>{assert.equal(new URL(String(input),"https://fixture.invalid").searchParams.get("centerId"),centerId);assert.equal(init?.method,"GET");reads++;return Response.json({data:{items:reads===1?[record]:[],nextCursor:null}});};
 const list=await state.provider.list(queryDefault,scope,fetcher,signal);
 assert.equal(list.total,1);assert.equal(list.records[0]?.centerId,centerId);assert.equal(state.relation(id(1))?.subscriptionId,id(2));
 assert.equal(await state.provider.detail(id(1),scope,fetcher,signal),null);assert.equal(state.relation(id(1)),undefined);assert.equal(reads,2);
 assert.equal(state.provider.mutation,undefined);assert.equal(state.provider.history,undefined);
 await assert.rejects(()=>state.provider.list(queryDefault,{surface:"HO"},fetcher,signal));assert.equal(reads,2);
 state.dispose();
});
test("PAP-2181 detail refuses denied reread and aborted result",async()=>{
 const state=enrollmentProvider();
 await assert.rejects(()=>state.provider.detail(id(1),scope,async()=>new Response(null,{status:403}),new AbortController().signal));
 const ctl=new AbortController();ctl.abort();
 await assert.rejects(()=>state.provider.detail(id(1),scope,async()=>{throw Error("Unexpected request");},ctl.signal),{name:"AbortError"});
 state.dispose();
});
test("PAP-2181 real shared session binding preserves admitted schema and revalidates Center and actor on detail",async()=>{
 const other=id(200);let currentCenter=centerId,actor=id(900),reads=0;
 const fetcher:typeof fetch=async(input,init)=>{
  const url=new URL(String(input));assert.equal(url.origin,"https://bo.staging.pinohouse.art");assert.equal(init?.method,"GET");
  if(url.pathname==="/api/bo/context")return Response.json({data:{surface:"BO",entitled:true,userId:actor,permissionKeys:["team.bo.access",READ,"student.profile.view"]}});
  if(url.pathname==="/api/bo/centers")return Response.json({data:[{id:currentCenter}]});
  if(url.pathname==="/api/bo/school/enrollments"){
   assert.equal(url.searchParams.get("centerId"),currentCenter);reads++;
   return Response.json({data:{items:[{...record,createdAt:"2026-11-01T06:00:00Z",updatedAt:null}],nextCursor:null}});
  }
  throw Error("Unexpected read "+url.pathname);
 };
 const signal=new AbortController().signal;
 const projection=enrollmentProvider(),session=surfaceSession("BO","https://bo.staging.pinohouse.art",fetcher,{id:centerId,source:"centers"});
 try{
  const adapter=await bindSurface(session,{registry:new TddRegistry(),definition,provider:projection.provider},signal);
  assert.equal(canonicalEnrollmentSchema(enrollmentSchema,adapter.schema),adapter.schema);
  assert.equal((await adapter.list(queryDefault,signal)).rows[0]?.id,record.id);
  assert.equal((await adapter.detail(record.id,signal))?.row.id,record.id);
  assert.equal(adapter.capabilities.edit,false);
  currentCenter=other;
  await assert.rejects(adapter.detail(record.id,signal));
  assert.equal(reads,2);
  assert.equal(session.context.authorize(READ),false);
 }finally{session.dispose();projection.dispose();}
 currentCenter=centerId;
 const fresh=enrollmentProvider(),freshSession=surfaceSession("BO","https://bo.staging.pinohouse.art",fetcher,{id:centerId,source:"centers"});
 try{
  const adapter=await bindSurface(freshSession,{registry:new TddRegistry(),definition,provider:fresh.provider},signal);
  actor=id(901);await assert.rejects(adapter.list(queryDefault,signal));assert.equal(reads,2);
 }finally{freshSession.dispose();fresh.dispose();}
});
