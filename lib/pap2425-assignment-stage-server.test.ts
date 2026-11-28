import assert from "node:assert/strict";
import test from "node:test";
import {authorizeAssignmentStageReview} from "../app/bo/missions/assignment-stage-admission.server";
import type {BoReadEnv} from "../lib/bo-read-handler";
const center="00000000-0000-4000-8000-000000000001";
const url=new URL("https://bo.staging.pinohouse.art/bo/missions?centerId="+center);
const keys=["team.bo.access","student.mission_assignment.view","student.mission_assignment.manage"];
function setup(opts:{keys?:string[];noCenter?:boolean;changedActor?:boolean;scopeStatus?:number;badRow?:boolean;environment?:string;changedCenter?:boolean}={}){
 const calls:string[]=[];let contexts=0,centers=0;
 const env:BoReadEnv={APP_ENV:opts.environment??"staging",PINO_BO_CORE:{async executeWithStaffPassword(req,token){
  assert.equal(token,"test-only");assert.equal(req.method,"GET");calls.push(req.path);
  let data:unknown;
  if(req.path==="context"){contexts++;data={surface:"BO",entitled:true,userId:opts.changedActor&&contexts>1?"changed":"actor",email:"actor@example.invalid",permissionKeys:opts.keys??keys};}
  else if(req.path==="centers"){centers++;data=opts.noCenter||(opts.changedCenter&&centers>1)?[]:[{id:center,displayName:"Test Center"}];}
  else {assert.equal(req.path,"learning/mission-assignments?centerId="+center+"&limit=1&offset=0");data=opts.badRow?[{centerId:"wrong"}]:[];}
  return {status:req.path.startsWith("learning/")?opts.scopeStatus??200:200,body:{data},requestId:"test"};
 }}};
 const headers=new Headers({host:"bo.staging.pinohouse.art",cookie:"pino_staff_password_session=test-only"});
 return {calls,input:{url,headers,env,featureEnabled:true}};
}
test("PAP-2425 server review binds actual BO actor and authorized Center, returns no data",async()=>{
 const {input,calls}=setup();
 assert.deepEqual(await authorizeAssignmentStageReview(input),{actorId:"actor",centerId:center,centerSource:"centers"});
 assert.deepEqual(calls,["context","centers","learning/mission-assignments?centerId="+center+"&limit=1&offset=0","context","centers"]);
});
test("PAP-2425 server gate rejects disabled/foreign/missing auth before scoped read",async()=>{
 for(const variant of ["disabled","host","environment","anonymous"]){
  const {input,calls}=setup({environment:variant==="environment"?"production":undefined});
  if(variant==="disabled")input.featureEnabled=false;
  if(variant==="host")input.headers.set("host","bo.pinohouse.art");
  if(variant==="anonymous")input.headers.delete("cookie");
  await assert.rejects(authorizeAssignmentStageReview(input));assert.deepEqual(calls,[]);
 }
});
test("PAP-2425 server denies absent permission, wrong Center, stale actor/scope and invalid proof",async()=>{
 for(const opts of [{keys:keys.slice(0,2)},{noCenter:true},{scopeStatus:403},{badRow:true},{changedActor:true},{changedCenter:true}]){
  await assert.rejects(authorizeAssignmentStageReview(setup(opts).input));
 }
});
