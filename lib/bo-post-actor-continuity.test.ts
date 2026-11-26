import {test} from "node:test";
import assert from "node:assert/strict";
import {handleBoPostDraftRequest,type BoPostDraftEnv} from "./bo-post-draft-handler";
import {handleBoPostMediaRequest} from "./bo-post-media-handler";
import {handleBoPostWorkflowRequest} from "./bo-post-workflow-handler";
import {handleBoPostWorkflowRead} from "./bo-post-workflow-read-handler";
import type {BoAccessRequest} from "./bo-core";
const id=(n:number)=>"01900000-0000-7000-8000-"+String(n).padStart(12,"0"),C=id(1),P=id(2),A=id(3),actor=id(4),other=id(5),base="learning/piner-posts",root=base+"/"+P,origin="https://bo.staging.pinohouse.art";
const routes=[
 {handle:handleBoPostDraftRequest,path:root,method:"PATCH",permission:"piner.post.edit",body:{caption:"QA",expectedVersion:1}},
 {handle:handleBoPostMediaRequest,path:root+"/attachments/"+A+"/revoke",method:"POST",permission:"piner.post.edit",body:{expectedPostVersion:1,expectedAttachmentVersion:2}},
 {handle:handleBoPostWorkflowRequest,path:root+"/submit",method:"POST",permission:"piner.post.submit",body:{expectedVersion:1,attachmentIds:[A]}},
 {handle:handleBoPostWorkflowRead,path:root+"/workflow-state",method:"GET",permission:"piner.post.diary.compose",body:undefined},
 {handle:handleBoPostDraftRequest,path:base,method:"GET",permission:"piner.post.view",body:undefined}
] as const;
test("PAP-2386 binds every native Post command and private read to the current same-credential actor and selected Center",async()=>{
 for(const route of routes){
  for(const mode of ["valid","changed","missing","malformed","combined","no-action","no-view","wrong-surface","not-entitled","revoked"] as const){
   const calls:BoAccessRequest[]=[];
   const env:BoPostDraftEnv={APP_ENV:"staging",PINO_BO_CORE:{async executeWithStaffPassword(r,t){assert.equal(t,"synthetic-session");calls.push(r);if(r.path==="context")return {status:mode==="revoked"?403:200,requestId:"qa",body:{data:{userId:mode==="changed"?other:actor,surface:mode==="wrong-surface"?"HO":"BO",entitled:mode!=="not-entitled",permissionKeys:mode==="no-view"?[route.permission==="piner.post.view"?"unrelated":route.permission]:mode==="no-action"?[]:["piner.post.view",route.permission]}}};return {status:200,body:{data:{}},requestId:"qa"};}}};
   const headers=new Headers({cookie:"pino_staff_password_session=synthetic-session",origin});
   if(mode!=="missing")headers.set("x-pino-expected-actor",mode==="malformed"?"bad":mode==="combined"?actor+","+other:actor);
   if(route.body){headers.set("content-type","application/json");headers.set("idempotency-key","actor-continuity-test-001");}
   const r=await route.handle(new Request(origin+"/api/bo/"+route.path+"?centerId="+C,{method:route.method,headers,...(route.body?{body:JSON.stringify(route.body)}:{})}),env,route.path);
   assert.equal(r.status,mode==="valid"?200:["missing","malformed","combined"].includes(mode)?400:403,route.path+" "+mode);
   if(["missing","malformed","combined"].includes(mode))assert.equal(calls.length,0);
   else {assert.deepEqual(calls[0],{method:"GET",path:"context",resource:{centerId:C}});assert.equal(calls.length,mode==="valid"?2:1);}
  }
 }
});
