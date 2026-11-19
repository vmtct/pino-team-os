// PAP-2164: actual runtime binding, no real credentials or live Core writes.
import {test} from "node:test";
import assert from "node:assert/strict";
import {loadWorkshopRuntime,workshopHistory} from "../app/components/mytime-workshop/runtime-binding";
import type {WorkshopDto} from "../app/components/mytime-workshop/api-client";
import {boWorkshopSchema,canonicalWorkshopSchema,workshopBinding} from "../app/components/mytime-workshop/schema";
import type {AuthorizationContext} from "./workspace-schema";
const id=(n:number)=>"01a03c6e-cc58-7d81-ac8e-"+String(n).padStart(12,"0");
const start="2026-11-29T07:00:00.000Z",end="2026-11-29T10:00:00.000Z";
const row:WorkshopDto={id:id(1),name:"QA Workshop",centerId:id(2),startAt:start,endAt:end,missionIds:[id(3)],specialtyId:null,capacity:10,note:null,eventLeadStaffId:id(4),academicLeadStaffId:null,otherStaffIds:[id(5)],facebookUrl:null,status:"SCHEDULED",version:1,createdAt:start,updatedAt:start,createdByName:"QA Founder",updatedByName:"QA Founder",references:{center:{id:id(2),label:"QA Center"},missions:[{id:id(3),label:"QA Mission"}],specialty:null,eventLead:{id:id(4),label:"Same name"},academicLead:null,otherStaff:[{id:id(5),label:"Same name"}]}};
const context:AuthorizationContext={surface:"HO",authorize:k=>k==="learning.mytime_workshop.ho_manage"};
const signal=new AbortController().signal;
test("PAP-2164 actual runtime binding sends canonical duplicate-name IDs and replays same patch after uncertain response",async()=>{
 const requests:{method:string;body:unknown;key:string|null}[]=[];let event=row;
 const fetcher:typeof fetch=async(input,init)=>{
  const url=new URL(String(input),"https://ho.staging.pinohouse.art"),method=init?.method??"GET",tail=url.pathname.split("/mytime-workshops")[1];
  if(method==="GET"&&tail==="")return Response.json({data:{events:[event],nextBeforeId:null,scopeCenterId:null}});
  if(method==="GET"&&tail?.startsWith("/lookup/")){
   const data=tail.endsWith("/centers")?[row.references.center]:tail.endsWith("/missions")?row.references.missions:tail.endsWith("/staff")?[row.references.eventLead,...row.references.otherStaff]:[];
   return Response.json({data});
  }
  if(method==="GET"&&tail==="/"+row.id)return Response.json({data:event});
  requests.push({method,body:JSON.parse(String(init?.body)),key:new Headers(init?.headers).get("idempotency-key")});
  if(requests.length===1){event={...event,academicLeadStaffId:id(5),version:2,references:{...event.references,academicLead:row.references.otherStaff[0]!}};return Response.json({error:"uncertain"},{status:503});}
  return Response.json({data:{event,committedVersion:2,replayed:true}});
 };
 const runtime=await loadWorkshopRuntime({surface:"HO"},signal,fetcher),first=runtime.rows[0]!,port=runtime.port!;
 assert.notEqual(first.row.eventLead,first.row.otherStaff?.[0]);assert.equal(runtime.choices.staff.length,2);
 const token=first.row.otherStaff![0]!;
 await assert.rejects(port.update.update(row.id,{academicLead:token},"1",context,signal));
 const saved=await port.update.update(row.id,{academicLead:token},"1",context,signal);
 assert.equal(saved.status,"saved");assert.equal(requests.length,2);
 assert.deepEqual(requests[0],requests[1]);
 assert.deepEqual(requests[0]?.body,{academicLeadStaffId:id(5),expectedVersion:1});
 assert.equal((await runtime.read(row.id)).version,"2");
 assert.equal((await port.update.update(row.id,{name:"Stale"},"1",context,signal)).status,"conflict");
 assert.equal((await port.update.update(row.id,{name:"Denied"},"2",{surface:"HO",authorize:()=>false},signal)).status,"denied");
 assert.equal(requests.length,2);
});
test("PAP-2164 BO runtime opens only current Center and projects redacted genuine History",async()=>{
 const seen:string[]=[];
 const fetcher:typeof fetch=async(input,init)=>{
  assert.equal(init?.method,"GET");
  const url=new URL(String(input),"https://bo.staging.pinohouse.art");
  assert.equal(url.searchParams.get("centerId"),id(2));seen.push(url.pathname);
  if(url.pathname.endsWith("/history"))return Response.json({data:{events:[{id:id(8),occurredAt:start,actorName:"QA Founder",action:"learning.mytime_workshop_create",after:{note:"private"}}],nextBeforeId:null}});
  if(url.pathname.endsWith(row.id))return Response.json({data:row});
  return Response.json({data:{events:[row],scopeCenterId:id(2),nextBeforeId:null}});
 };
 const runtime=await loadWorkshopRuntime({surface:"BO",centerId:id(2)},signal,fetcher);
 assert.equal(runtime.port,undefined);assert.deepEqual(runtime.choices.staff,[]);
 // Historical referenced names remain visible, but no Staff catalog was fetched.
 assert.ok(runtime.rows[0]?.row.eventLead);
 assert.equal((await runtime.read(row.id)).row.id,row.id);
 const history=await workshopHistory(runtime.api,{type:"mytime_workshop",id:row.id},null,signal);
 assert.equal(history.status,"authorized");assert.doesNotMatch(JSON.stringify(history),/private/);
 assert.equal((await workshopHistory(runtime.api,{type:"other",id:row.id},null,signal)).status,"denied");
 assert.equal(seen.length,3);assert.ok(seen.every(p=>!p.includes("lookup")));
});

test("PAP-2164 fresh BO deep link projects newly referenced identities without directory access",async()=>{
 const fresh:WorkshopDto={...row,id:id(10),eventLeadStaffId:id(11),missionIds:[id(12)],references:{...row.references,eventLead:{id:id(11),label:"Same name"},missions:[{id:id(12),label:"New mission"}]}};
 const fetcher:typeof fetch=async(input,init)=>{
  const url=new URL(String(input),"https://bo.staging.pinohouse.art");
  assert.equal(init?.method,"GET");assert.equal(url.searchParams.get("centerId"),id(2));assert.ok(!url.pathname.includes("lookup"));
  return Response.json(url.pathname.endsWith(fresh.id)?{data:fresh}:{data:{events:[row],scopeCenterId:id(2),nextBeforeId:null}});
 };
 const runtime=await loadWorkshopRuntime({surface:"BO",centerId:id(2)},signal,fetcher);
 const value=await runtime.read(fresh.id);
 assert.equal(value.row.id,fresh.id);assert.equal(value.row.missions?.[0],"New mission");
 assert.notEqual(value.row.eventLead,runtime.rows[0]?.row.eventLead);
 assert.deepEqual(runtime.choices.staff,[]);assert.deepEqual(runtime.choices.missions,[]);
});
test("PAP-2164 real BO runtime schema permits choices and scoped history, not changed authority",()=>{
 const caps={read:"learning.mytime_workshop.bo_view",create:"learning.mytime_workshop.ho_manage",edit:"learning.mytime_workshop.ho_manage",history:"learning.mytime_workshop.bo_view"};
 const choices={centers:["QA Center"],missions:["QA Mission"],specialties:[],staff:[]};
 const history={kind:"provider" as const,source:{adapter:"core-mytime-workshop-history",permission:caps.history},load:async()=>({status:"denied" as const})};
 const schema=workshopBinding("BO",choices,caps,history).schema;
 assert.equal(canonicalWorkshopSchema(boWorkshopSchema,schema),schema);
 assert.throws(()=>canonicalWorkshopSchema(boWorkshopSchema,workshopBinding("BO",choices,{...caps,read:"other"},history).schema),/admitted schema/);
 assert.throws(()=>canonicalWorkshopSchema(boWorkshopSchema,workshopBinding("BO",choices,caps,{...history,source:{...history.source,permission:"other"}}).schema),/history authorization/);
});