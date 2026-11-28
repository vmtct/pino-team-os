import assert from "node:assert/strict";
import test from "node:test";
import {verifyCameraStageClient} from "./pap1612-camera-stage-client";
import {CAMERA_STAGE_HOST,CAMERA_STAGE_PATH} from "./pap1612-camera-stage-route";
const centerId="01912345-6789-7abc-8def-0123456789ab",proof={actorId:"actual-actor",centerId};
for(const surface of ["BO","TOS"] as const){
 const url=new URL("https://"+CAMERA_STAGE_HOST[surface]+CAMERA_STAGE_PATH[surface]+"?cameraReview=1&centerId="+centerId);
 function fixture(fault:string=""){
  const calls:string[]=[];
  let contextCount=0;
  const fetcher:typeof fetch=async(input,init)=>{
   const target=new URL(String(input));calls.push(target.pathname);
   assert.equal(target.origin,url.origin);assert.equal(init?.method,"GET");assert.equal(init?.credentials,"same-origin");assert.equal(init?.cache,"no-store");
   let data:unknown;
   if(target.pathname.endsWith("/context")){
    contextCount++;
    const userId=fault==="actor"||fault==="changed"&&contextCount>1?"other":proof.actorId;
    data=surface==="BO"?{userId,surface:"BO",entitled:true,permissionKeys:fault==="permission"?["team.bo.access"]:["team.bo.access","staff.timekeeping.view"]}:{userId,staffMemberId:"actual-staff",founderMode:fault==="founder",centers:[{id:fault==="center"?"other":centerId}]};
   }else if(target.pathname.endsWith("/centers"))data=[{id:fault==="center"?"other":centerId}];
   else if(surface==="BO")data={data:fault==="foreign"?[{centerId:"other"}]:[]};
   else data=fault==="foreign"?{centerId:"other"}:null;
   return Response.json({data},{status:fault==="denied"?403:200});
  };
  return {fetcher,calls};
 }
 test("PAP-1612 "+surface+" actual client principal and Center readback",async()=>{
  const f=fixture();assert.deepEqual(await verifyCameraStageClient(surface,url,proof,new AbortController().signal,f.fetcher),proof);assert.equal(f.calls.filter(p=>p.endsWith("/context")).length,2);
 });
 test("PAP-1612 "+surface+" client fails closed on principal, scope or transport changes",async()=>{
  for(const fault of ["actor","changed","center","foreign","denied",surface==="BO"?"permission":"founder"]){const f=fixture(fault);await assert.rejects(verifyCameraStageClient(surface,url,proof,new AbortController().signal,f.fetcher));}
  const f=fixture();await assert.rejects(verifyCameraStageClient(surface,url,{...proof,centerId:"other"},new AbortController().signal,f.fetcher));assert.equal(f.calls.length,0);
 });
}
