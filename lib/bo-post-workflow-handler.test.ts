import {test} from "node:test";
import assert from "node:assert/strict";
import {handleBoPostWorkflowRequest,matchPostWorkflow} from "./bo-post-workflow-handler";
import type {BoAccessRequest} from "./bo-core";
import type {BoPostDraftEnv} from "./bo-post-draft-handler";
const uid=(n:number)=>"01900000-0000-7000-8000-"+String(n).padStart(12,"0");
const center=uid(1),root="learning/piner-posts/"+uid(2),host="https://bo.staging.pinohouse.art",key="workflow-handler-0001";
const setup=()=>{const calls:BoAccessRequest[]=[];const env:BoPostDraftEnv={APP_ENV:"staging",PINO_BO_CORE:{async executeWithStaffPassword(r,t){assert.equal(t,"synthetic-session");calls.push(r);return {status:200,body:{data:{committedVersion:5,replayed:false}},requestId:"qa"};}}};return {calls,env};};
function req(path:string,body:object,opts:{host?:string;origin?:string;cookie?:string;query?:string;method?:string;key?:string}={}){
 const method=opts.method??"POST";return new Request((opts.host??host)+"/api/bo/"+path+(opts.query??"?centerId="+center),{method,headers:{origin:opts.origin??host,cookie:opts.cookie??"pino_staff_password_session=synthetic-session","content-type":"application/json","idempotency-key":opts.key??key},...(method==="GET"?{}:{body:JSON.stringify(body)})});
}
test("PAP-2386 exact three workflow routes forward same session, scoped target and ordered payload",async()=>{
 const {calls,env}=setup(),cases=[
 [root+"/submit",{expectedVersion:4,attachmentIds:[uid(4),uid(3)]}],
 [root+"/diary-selection",{expectedVersion:4,diaryIds:[uid(5)]}],
 [root+"/attachments/"+uid(3)+"/diary-provenance",{expectedVersion:4,expectedAttachmentVersion:2,diaryId:uid(5),evidenceId:uid(6),transform:"RAW"}]
 ] as const;
 for(const [path,body] of cases){const r=await handleBoPostWorkflowRequest(req(path,body),env,path);assert.equal(r.status,200);assert.equal(r.headers.get("cache-control"),"no-store");}
 assert.deepEqual(calls,cases.map(([path,body])=>({method:"POST",path:path+"?centerId="+center,resource:{centerId:center},body,idempotencyKey:key})));
});
test("PAP-2386 denies foreign host, production, method, origin, support, invalid IDs, duplicate queries and body fields",async()=>{
 const {calls,env}=setup(),path=root+"/submit",body={expectedVersion:4,attachmentIds:[uid(3)]};
 for(const [r,status] of [[req(path,body,{host:"https://bo.pinohouse.art"}),404],[req(path,body,{method:"GET"}),405],[req(path,body,{origin:"https://other.invalid"}),403],[req(path,body,{cookie:""}),401],[req(path,body,{cookie:"pino_staff_password_session=synthetic-session; pino_support_session=synthetic-support"}),403],[req(path,body,{query:"?centerId="+center+"&centerId="+center}),400],[req(path,{...body,attachmentIds:[uid(3),uid(3)]}),400],[req(path,{...body,centerId:center}),400],[req(path,body,{key:"short"}),400],[req(path,{...body,expectedVersion:0}),400],[req(path,{...body,attachmentIds:["invalid"]}),400],[req(path,{...body,extra:"x".repeat(9000)}),400]] as const)assert.equal((await handleBoPostWorkflowRequest(r,env,path)).status,status);
 assert.equal((await handleBoPostWorkflowRequest(req(path,body),{...env,APP_ENV:"production"},path)).status,404);
 assert.equal(matchPostWorkflow(root+"/publish"),null);assert.equal(calls.length,0);
});
