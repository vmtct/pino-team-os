import {test} from "node:test";
import assert from "node:assert/strict";
import {handleBoPostWorkflowRead,matchPostWorkflowRead} from "./bo-post-workflow-read-handler";
import type {BoAccessRequest} from "./bo-core";
import type {BoPostDraftEnv} from "./bo-post-draft-handler";
const uid=(n:number)=>"01900000-0000-7000-8000-"+String(n).padStart(12,"0");
const center=uid(1),root="learning/piner-posts/"+uid(2),diary=uid(3),evidence=uid(4),host="https://bo.staging.pinohouse.art";
const setup=()=>{const calls:BoAccessRequest[]=[];const env:BoPostDraftEnv={APP_ENV:"staging",PINO_BO_CORE:{async executeWithStaffPassword(r,t){assert.equal(t,"synthetic-session");calls.push(r);return {status:200,body:{data:{version:7}},requestId:"qa"};}}};return {calls,env};};
const req=(path:string,opts:{host?:string;query?:string;method?:string;headers?:Record<string,string>}={})=>new Request((opts.host??host)+"/api/bo/"+path+(opts.query??"?centerId="+center),{method:opts.method??"GET",headers:{cookie:"pino_staff_password_session=synthetic-session",...opts.headers}});
test("PAP-2386 exact read BFF passes four paths and same BO credential",async()=>{
 const {calls,env}=setup();
 for(const path of [root+"/workflow-state",root+"/diaries",root+"/diaries/"+diary+"/photos",root+"/diaries/"+diary+"/photos/"+evidence]){
  const r=await handleBoPostWorkflowRead(req(path),env,path);assert.equal(r.status,200);assert.equal(r.headers.get("cache-control"),"no-store");assert.deepEqual(calls.at(-1),{method:"GET",path:path+"?centerId="+center,resource:{centerId:center}});
 }
 const path=root+"/diaries",query="?centerId="+center+"&after="+diary+"&limit=10";
 assert.equal((await handleBoPostWorkflowRead(req(path,{query}),env,path)).status,200);assert.equal(calls.at(-1)?.path,path+query);
});
test("PAP-2386 read BFF rejects scope widening, foreign host, support and mutation",async()=>{
 const {calls,env}=setup(),path=root+"/workflow-state",q="?centerId="+center;
 for(const [r,status] of [[req(path,{host:"https://bo.pinohouse.art"}),404],[req(path,{method:"POST"}),405],[req(path,{headers:{origin:"https://other.invalid"}}),403],[req(path,{headers:{"sec-fetch-site":"cross-site"}}),403],[req(path,{headers:{cookie:""}}),401],[req(path,{headers:{cookie:"pino_staff_password_session=synthetic-session; pino_support_session=synthetic"}}),403],[req(path,{query:q+"&centerId="+center}),400],[req(path,{query:q+"&limit=1"}),400],[req(path,{headers:{"idempotency-key":"synthetic-command-0001"}}),400]] as const)assert.equal((await handleBoPostWorkflowRead(r,env,path)).status,status);
 assert.equal((await handleBoPostWorkflowRead(req(path),{...env,APP_ENV:"production"},path)).status,404);
 assert.equal(matchPostWorkflowRead(root+"/diaries/"+diary+"/photos/other"),null);assert.equal(calls.length,0);
});
