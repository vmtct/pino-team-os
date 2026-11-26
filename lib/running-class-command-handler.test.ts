import test from "node:test";
import assert from "node:assert/strict";
import {handleRunningClassCommand,runningClassCommandMethod} from "./running-class-command-handler";
import {handleBoWriteRequest} from "./bo-write-handler";
import {decideHostBoundary} from "./host-boundary";
import type {BoAccessRequest,BoAccessCoreBinding} from "./bo-core";
const id=(n:number)=>"01234567-89ab-7abc-8def-"+String(n).padStart(12,"0");
const center=id(1),actor=id(2),classId=id(3);
const origin="https://bo.staging.pinohouse.art",create="delivery/running-classes/create-inactive",edit="delivery/running-classes/"+classId+"/inline";
const body={centerId:center,pathProgramId:id(4),learningSpaceId:id(5),operationalName:"Piano",weekdayIso:1,windowStartsLocal:"18:00",windowEndsLocal:"19:30",deliveryTopology:"FIXED_COHORT",optimalConcurrentCapacity:8,hardConcurrentCapacity:null,defaultParticipationMinutes:null,status:"INACTIVE"};
const key="01234567-89ab-7abc-8def-000000000006";
function fixture(overrides:Record<string,unknown>={}){
 const calls:BoAccessRequest[]=[];
 const binding:BoAccessCoreBinding={async executeWithStaffPassword(r){calls.push(r);return r.path==="context"?{status:200,body:{data:{userId:actor,surface:"BO",entitled:true,permissionKeys:["delivery.schedule.manage"],...overrides}},requestId:"context"}:{status:r.method==="POST"?201:200,body:{data:{id:classId}},requestId:"command"};}};
 return {calls,env:{APP_ENV:"staging",PINO_BO_CORE:binding}};
}
function req(path:string,method:string,form:unknown,options:{host?:string;query?:string;principal?:string;key?:string;origin?:string;cookie?:boolean}={}){
 const headers=new Headers({"content-type":"application/json","origin":options.origin??origin,"x-pino-expected-principal":options.principal??actor});
 if(options.cookie!==false)headers.set("cookie","pino_staff_password_session=synthetic-session");
 if(options.key!==undefined)headers.set("idempotency-key",options.key);
 return new Request((options.host??origin)+"/api/bo/"+path+(options.query??"?centerId="+center),{method,headers,...(method==="GET"?{}:{body:JSON.stringify(form)})});
}
test("exact methods and same-credential scoped context, create replay and inline CAS forwarding",async()=>{
 const m=fixture();
 assert.equal(runningClassCommandMethod(create),"POST");assert.equal(runningClassCommandMethod(edit),"PATCH");assert.equal(runningClassCommandMethod(edit+"/extra"),null);
 const r=await handleRunningClassCommand(req(create,"POST",body,{key}),m.env,create);
 assert.equal(r.status,201);assert.equal(r.headers.get("x-request-id"),"command");
 const changes={expectedVersion:1,operationalName:"Art"};
 assert.equal((await handleRunningClassCommand(req(edit,"PATCH",changes),m.env,edit)).status,200);
 assert.deepEqual(m.calls,[{method:"GET",path:"context",resource:{centerId:center}},{method:"POST",path:create,body,resource:{centerId:center},idempotencyKey:key},{method:"GET",path:"context",resource:{centerId:center}},{method:"PATCH",path:edit,body:changes,resource:{centerId:center,runningClassId:classId}}]);
});
test("wrong host/env/origin/verb/Center/principal/key/immutable field denied before Core",async()=>{
 const m=fixture();
 const cases:[Request,string,number][]=[
 [req(create,"POST",body,{key,host:"https://bo.pinohouse.art"}),create,404],
 [req(create,"POST",body,{key,origin:"https://example.com"}),create,403],
 [req(create,"PATCH",body,{key}),create,405],
 [req(create,"POST",body),create,400],
 [req(create,"POST",body,{key,query:"?centerId="+center+"&centerId="+center}),create,400],
 [req(create,"POST",{...body,centerId:id(9)},{key}),create,400],
 [req(create,"POST",{...body,status:"ACTIVE"},{key}),create,400],
 [req(create,"POST",body,{key,principal:"bad"}),create,400],
 [req(edit,"PATCH",{expectedVersion:1,centerId:center}),edit,400],
 [req(edit,"PATCH",{expectedVersion:0,status:"ACTIVE"}),edit,400],
 [req(create,"POST",body,{key,cookie:false}),create,401]
 ];
 for(const [r,p,status] of cases)assert.equal((await handleRunningClassCommand(r,m.env,p)).status,status);
 assert.equal((await handleRunningClassCommand(req(create,"POST",body,{key}),{...m.env,APP_ENV:"production"},create)).status,404);
 assert.equal(m.calls.length,0);
});
test("actor change or missing effective permission prevents mutation after independent context",async()=>{
 for(const override of [{userId:id(9)},{permissionKeys:[]},{surface:"HO"},{entitled:false}]){
  const m=fixture(override);assert.equal((await handleRunningClassCommand(req(create,"POST",body,{key}),m.env,create)).status,403);
  assert.deepEqual(m.calls,[{method:"GET",path:"context",resource:{centerId:center}}]);
 }
});

test("mounted write facade and host fence retain exact scoped commands only",async()=>{
 const m=fixture();
 for(const [path,method,form] of [[create,"POST",body],[edit,"PATCH",{expectedVersion:1,status:"ACTIVE"}]] as const){
  const pathname="/api/bo/"+path;
  assert.deepEqual(decideHostBoundary("bo.staging.pinohouse.art",pathname,method),{action:"next"});
  for(const host of ["bo.pinohouse.art","ho.staging.pinohouse.art","tos.staging.pinohouse.art"])assert.deepEqual(decideHostBoundary(host,pathname,method),{action:"not_found"});
  for(const verb of ["GET","PUT","DELETE",method==="POST"?"PATCH":"POST"])assert.deepEqual(decideHostBoundary("bo.staging.pinohouse.art",pathname,verb),{action:"not_found"});
  assert.equal((await handleBoWriteRequest(req(path,method,form,method==="POST"?{key}:{}),m.env,path)).status,method==="POST"?201:200);
 }
 assert.equal(m.calls.length,4);
 const wrong=fixture({userId:id(9)});
 assert.equal((await handleBoWriteRequest(req(create,"POST",body,{key}),wrong.env,create)).status,403);assert.equal(wrong.calls.length,1);
});
