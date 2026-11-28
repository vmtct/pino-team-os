import test from "node:test";
import assert from "node:assert/strict";
import {verifyStaffStageReview} from "../app/ho/staff/staff-stage-review-client";
import type {StaffStageProof} from "../app/ho/staff/staff-stage-review-admission.server";
const actor="review-actor",center="12345678-1234-4abc-8abc-123456789abc",proof:StaffStageProof={surface:"BO",actorId:actor,centerId:center,centerSource:"centers"},url=new URL("https://bo.staging.pinohouse.art/bo/workforce/staffs?staffReview=1&centerId="+center);
const signal=()=>new AbortController().signal;
function fixture({wrongActor=false,wrongCenter=false,denyRead=false,stale=false,missingPermission=false,malformed=false}={}){
 const calls:string[]=[];let reads=0;
 const fetcher:typeof fetch=async(input,init)=>{
  const u=new URL(String(input));assert.equal(init?.method,"GET");assert.equal(u.origin,url.origin);calls.push(u.pathname+u.search);
  if(u.pathname==="/api/bo/context")return Response.json({data:{surface:"BO",entitled:true,userId:wrongActor||stale&&++reads>1?"other":actor,permissionKeys:missingPermission?[]:["team.bo.access"]}});
  if(u.pathname==="/api/bo/centers")return Response.json({data:[{id:wrongCenter?"other":center}]});
  if(!["/api/bo/workforce/staff-records","/api/bo/workforce/staff-registration-requests"].includes(u.pathname)||u.searchParams.get("centerId")!==center)throw Error("unexpected request");
  if(denyRead)return new Response(null,{status:403});
  return Response.json({data:malformed?{}:[]});
 };
 return {calls,fetcher};
}
test("PAP-2423 client scope recheck uses only current actor and scoped GET, returns no real rows",async()=>{
 const {calls,fetcher}=fixture();assert.deepEqual(await verifyStaffStageReview({url,proof,signal:signal(),fetcher}),proof);
 assert.equal(calls.length,6);assert.equal(calls.filter(p=>p==="/api/bo/context").length,2);
});
test("PAP-2423 rejects wrong actor, Center, denied/malformed proof, stale actor and missing permission",async()=>{
 for(const option of [{wrongActor:true},{wrongCenter:true},{denyRead:true},{stale:true},{missingPermission:true},{malformed:true}]){
  const {fetcher}=fixture(option);await assert.rejects(verifyStaffStageReview({url,proof,signal:signal(),fetcher}));
 }
 const {calls,fetcher}=fixture();
 await assert.rejects(verifyStaffStageReview({url:new URL(url.href.replace(center,"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")),proof,signal:signal(),fetcher}));
 assert.equal(calls.length,0);
});
