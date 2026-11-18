import {test} from "node:test";
import assert from "node:assert/strict";
import {scopedEnrollmentClient} from "./bo-subscription-enrollment-client";
import {BoApiError} from "./bo-api-error";
const id=(n:number)=>"019a0f22-1111-7111-8111-"+String(n).padStart(12,"0");
const scope={subscriptionId:id(1),centerId:id(2)};
const day="2026-11-18";
const row={id:id(3),subscriptionId:scope.subscriptionId,runningClassId:id(4)};
const command={runningClassId:id(4),effectiveFromLocalDate:day,commandEffectiveLocalDate:day,policyEffectiveAt:day+"T04:00:00.000Z"};
const root="/api/bo/subscriptions/"+scope.subscriptionId+"/enrollment/";
void test("PAP-1035 client binds Center and subscription in every request and retains exact command key/body on retry",async()=>{
 const calls:{url:string;init?:RequestInit}[]=[];
 const fetcher:typeof fetch=async(input,init)=>{
  calls.push({url:String(input),init});
  if(String(input).includes("/list?"))return Response.json({data:[row]});
  if(String(input).includes("/placement?"))return Response.json({data:{subscriptionId:scope.subscriptionId,targetLocalDate:day,effectiveEnrollmentCount:1,weeklySessionCommitment:2}});
  if(String(input).includes("/capacity?"))return Response.json({data:{status:"AVAILABLE"}});
  return Response.json({data:row},{status:201});
 };
 const client=scopedEnrollmentClient(scope,fetcher);
 assert.equal((await client.list())[0]?.id,row.id);
 assert.equal((await client.placement(day)).effectiveEnrollmentCount,1);
 await client.capacity({runningClassId:id(4),targetLocalDate:day,plannedEntryLocalTime:"18:00",plannedDurationMinutes:90});
 await client.attach(command,"stable-key-123");
 await client.attach(command,"stable-key-123");
 const transfer={destinationRunningClassId:id(5),transferLocalDate:day,reason:"Move",commandEffectiveLocalDate:day,policyEffectiveAt:command.policyEffectiveAt};
 await client.transfer(row.id,transfer,"transfer-key-123");
 assert.equal(calls.length,6);
 for(const call of calls){
  assert.ok(call.url.startsWith(root));
  assert.equal(new URL(call.url,"https://example.test").searchParams.get("centerId"),scope.centerId);
  assert.equal(call.init?.credentials,"same-origin");
  assert.equal(call.init?.cache,"no-store");
  assert.equal(call.init?.redirect,"error");
 }
 assert.deepEqual(calls[3],calls[4]);assert.equal(new Headers(calls[3]?.init?.headers).get("idempotency-key"),"stable-key-123");
 assert.deepEqual(JSON.parse(String(calls[3]?.init?.body)),command);
 assert.ok(calls[5]?.url.includes("/transfer/"+row.id+"?"));assert.deepEqual(JSON.parse(String(calls[5]?.init?.body)),transfer);
});
void test("PAP-1035 client fails closed on foreign rows, mismatched placement, invalid scope, aborted reads and 409",async()=>{
 const client=scopedEnrollmentClient(scope,async()=>Response.json({data:[{...row,subscriptionId:id(99)}]}));
 await assert.rejects(client.list(),(e:unknown)=>e instanceof BoApiError&&e.status===502);
 const placement=scopedEnrollmentClient(scope,async()=>Response.json({data:{subscriptionId:scope.subscriptionId,targetLocalDate:"2026-11-19",effectiveEnrollmentCount:1,weeklySessionCommitment:2}}));
 await assert.rejects(placement.placement(day));
 assert.throws(()=>scopedEnrollmentClient({...scope,centerId:""}));
 let called=0;
 const aborted=scopedEnrollmentClient(scope,async()=>{called++;return Response.json({data:[]});});
 const ctl=new AbortController();ctl.abort();
 await assert.rejects(aborted.list(ctl.signal));assert.equal(called,0);
 const conflict=scopedEnrollmentClient(scope,async()=>Response.json({error:{message:"Conflict"}},{status:409}));
 await assert.rejects(conflict.attach(command,"stable-key-123"),(e:unknown)=>e instanceof BoApiError&&e.status===409);
});
