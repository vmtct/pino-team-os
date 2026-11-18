import {test} from "node:test";
import assert from "node:assert/strict";
import {planBoScopedEnrollment,executeBoScopedEnrollment,isBoScopedEnrollmentPath,handleBoScopedEnrollment} from "./bo-subscription-enrollment-facade";
import type {BoAccessRequest} from "./bo-core";
import {BO_STAGING_HOSTNAME} from "./host-boundary";
const id=(n:number)=>"019a0f22-1111-7111-8111-"+String(n).padStart(12,"0");
const sub=id(1),center=id(2),cls=id(3),enrollment=id(4);
const root="subscriptions/"+sub+"/enrollment/";
const base="https://"+BO_STAGING_HOSTNAME+"/api/bo/";
const day="2026-11-18",instant=day+"T04:00:00.000Z",key="stable-attempt-key";
const request=(suffix:string,query="centerId="+center,body?:unknown)=>new Request(base+root+suffix+"?"+query,body===undefined?{}:{method:"POST",headers:{"content-type":"application/json","idempotency-key":key},body:JSON.stringify(body)});
const attach={runningClassId:cls,effectiveFromLocalDate:day,commandEffectiveLocalDate:day,policyEffectiveAt:instant};
const transfer={destinationRunningClassId:cls,transferLocalDate:day,commandEffectiveLocalDate:day,policyEffectiveAt:instant,reason:"Change class"};
void test("PAP-1035 narrow read maps subject and selected Center into every Core request",async()=>{
 const list=await planBoScopedEnrollment(request("list"),root+"list");
 assert.deepEqual(list.core,{method:"GET",path:"subscriptions/"+sub+"/enrollments",resource:{centerId:center}});
 const placement=await planBoScopedEnrollment(request("placement","centerId="+center+"&targetLocalDate="+day),root+"placement");
 assert.deepEqual(placement.core.body,{targetLocalDate:day});
 const capacity=await planBoScopedEnrollment(request("capacity","centerId="+center+"&targetLocalDate="+day+"&runningClassId="+cls+"&plannedEntryLocalTime=18%3A00&plannedDurationMinutes=90"),root+"capacity");
 assert.deepEqual(capacity.core.body,{subscriptionId:sub,runningClassId:cls,targetLocalDate:day,plannedEntryLocalTime:"18:00",plannedDurationMinutes:90});
 assert.deepEqual(capacity.core.resource,{centerId:center});
});
void test("PAP-1035 attach binds URL subscription and retains exact idempotency key",async()=>{
 const p=await planBoScopedEnrollment(request("attach","centerId="+center,attach),root+"attach");
 assert.deepEqual(p.core,{method:"POST",path:"enrollments",resource:{centerId:center},body:{...attach,subscriptionId:sub},idempotencyKey:key});
});
void test("PAP-1035 transfer reads owned list before one exact command; foreign source cannot dispatch",async()=>{
 const p=await planBoScopedEnrollment(request("transfer/"+enrollment,"centerId="+center,transfer),root+"transfer/"+enrollment);
 const calls:BoAccessRequest[]=[];
 const result=await executeBoScopedEnrollment(p,r=>{calls.push(r);return Promise.resolve({status:r.method==="GET"?200:201,body:{data:r.method==="GET"?[{id:enrollment,subscriptionId:sub}]:{}},requestId:"receipt"});});
 assert.equal(result.status,201);assert.equal(calls.length,2);assert.deepEqual(calls[0],{method:"GET",path:"subscriptions/"+sub+"/enrollments",resource:{centerId:center}});assert.equal(calls[1]?.idempotencyKey,key);
 calls.length=0;
 const denied=await executeBoScopedEnrollment(p,r=>{calls.push(r);return Promise.resolve({status:200,body:{data:[{id:enrollment,subscriptionId:id(9)}]},requestId:"receipt"});});
 assert.equal(denied.status,404);assert.equal(calls.length,1);
});
void test("PAP-1035 reject missing/duplicate Center, overpost, invalid date, unpaired flex, forbidden verbs and hosts",async()=>{
 for(const req of [request("attach","",attach),request("attach","centerId="+center+"&centerId="+center,attach),
 request("attach","centerId="+center,{...attach,subscriptionId:id(9)}),request("attach","centerId="+center,{...attach,effectiveFromLocalDate:"2026-02-30"}),
 request("attach","centerId="+center,{...attach,plannedDurationMinutes:90}),request("attach"),
 new Request("https://ho.staging.pinohouse.art/api/bo/"+root+"attach?centerId="+center,{method:"POST"})])
  await assert.rejects(planBoScopedEnrollment(req,root+"attach"));
 assert.equal(isBoScopedEnrollmentPath(root+"end"),false);assert.equal(isBoScopedEnrollmentPath(root+"bulk-place"),false);
});
void test("PAP-1035 missing password credential cannot reach Core",async()=>{
 const env={} as Parameters<typeof handleBoScopedEnrollment>[1];
 assert.equal((await handleBoScopedEnrollment(request("list"),env,root+"list")).status,401);
});
