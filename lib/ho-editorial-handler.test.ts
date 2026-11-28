import test from "node:test";
import assert from "node:assert/strict";
import {handleHoEditorialRequest,type HoEditorialEnv} from "./ho-editorial-handler";
const base="https://ho.staging.pinohouse.art",root="/api/ho/learning/piner-posts/editorial",core="ho/learning/piner-posts/editorial";
const id="019d2170-0000-7000-8000-000000000001",center="019d2170-0000-7000-8000-000000000002",key="qa-editorial-command-01";
const q="?centerId="+center+"&status=PENDING_APPROVAL",body={action:"HIDE",postId:id,centerId:center,expectedVersion:2};
const calls:unknown[]=[];
function env(o:{founder?:boolean;read?:boolean;manage?:boolean;binding?:boolean;staging?:boolean;status?:number}={}):HoEditorialEnv{
 return {APP_ENV:o.staging===false?"production":"staging",HO_PILOT_FOUNDER_USER_IDS:"founder",PINO_BO_CORE:{async executeWithStaffPassword(r,token){
  if(token!=="valid")return {status:401,requestId:"qa",body:{error:{code:"AUTH_REQUIRED"}}};
  if(r.path==="ho/admission")return {status:o.founder===false?403:200,requestId:"qa",body:{data:{admitted:o.founder!==false}}};
  assert.equal(r.path,"context");
  return {status:200,requestId:"qa",body:{data:{userId:o.founder===false?"manager":"founder",email:"qa@example.invalid",surface:"BO",entitled:true,permissionKeys:["team.bo.access",...(o.read===false?[]:["piner.post.ho_view"]),...(o.manage===false?[]:["piner.post.ho_manage"])]}}};
 }},...(o.binding===false?{}:{PINO_HO_EDITORIAL_CORE:{async executeWithStaffPassword(r,token){calls.push({r,token});return {status:o.status??200,requestId:"editorial-qa",body:o.status?{error:{message:"private diagnostic"}}:{data:{}}};}}})};
}
function req(suffix="",method="GET",b?:unknown,o:{host?:string;hostHeader?:string;token?:string;origin?:string;key?:string;contentType?:string}={}){
 const host=o.host??base;
 return new Request(host+root+suffix,{method,headers:{host:o.hostHeader??new URL(host).hostname,cookie:"pino_staff_password_session="+(o.token??"valid"),...(method==="GET"?{}:{origin:o.origin??host,"content-type":o.contentType??"application/json","idempotency-key":o.key??key})},body:b===undefined?undefined:JSON.stringify(b)});
}
test("exact read queue, detail and history private routes",async()=>{
 calls.length=0;
 for(const s of [q,"/"+id+"?centerId="+center,"/"+id+"/history?centerId="+center+"&limit=50&offset=0"]){
  const r=await handleHoEditorialRequest(req(s),env({manage:false}));assert.equal(r.status,200);assert.equal(r.headers.get("cache-control"),"private, no-store");
 }
 assert.deepEqual(calls.map(x=>(x as {r:{path:string}}).r.path),[core+q,core+"/"+id+"?centerId="+center,core+"/"+id+"/history?centerId="+center+"&limit=50&offset=0"]);
 calls.length=0;for(const s of ["","/invalid",q+"&limit=51",q+"&centerId="+center,q+"&surface=HO","/"+id+"?centerId="+center+"&limit=1"])assert.ok([400,404].includes((await handleHoEditorialRequest(req(s),env())).status));assert.equal(calls.length,0);
});
test("exact decision body, origin and private receipt, no diagnostics",async()=>{
 calls.length=0;
 for(const b of [body,{...body,action:"RETURN",returnReason:"Revise"},{...body,action:"PUBLISH",caption:"Reviewed",attachmentIds:[id]},{...body,action:"REPUBLISH",caption:"Reviewed",attachmentIds:[id]}]){
  assert.equal((await handleHoEditorialRequest(req("/decision","POST",b),env())).status,200);
  assert.deepEqual(calls.at(-1),{r:{method:"POST",path:core+"/decision",body:b,idempotencyKey:key},token:"valid"});
 }
 const r=await handleHoEditorialRequest(req("/decision","POST",body),env({status:409}));assert.equal(r.status,409);assert.ok(!(await r.text()).includes("private diagnostic"));
 calls.length=0;
 for(const b of [{...body,actorId:id},{...body,idempotencyKey:key},{...body,expectedVersion:1},{...body,action:"PUBLISH",caption:"x",attachmentIds:[id,id]}])assert.equal((await handleHoEditorialRequest(req("/decision","POST",b),env())).status,400);
 assert.equal((await handleHoEditorialRequest(req("/decision","POST",{...body,action:"RETURN",returnReason:"a".repeat(9000)}),env())).status,413);
 assert.equal((await handleHoEditorialRequest(req("/decision","POST",body,{origin:"https://other.invalid"}),env())).status,403);
 assert.equal((await handleHoEditorialRequest(req("/decision","POST",body,{key:"short"}),env())).status,400);
 assert.equal((await handleHoEditorialRequest(req("/decision","POST",body,{contentType:"text/plain"}),env())).status,415);
 assert.equal(calls.length,0);
});
test("Founder, read/manage, host, session and missing binding fail closed",async()=>{
 calls.length=0;
 for(const [o,status] of [[{founder:false},403],[{read:false},403],[{manage:false},403],[{binding:false},503],[{staging:false},404]] as const)assert.equal((await handleHoEditorialRequest(req("/decision","POST",body),env(o))).status,status);
 assert.equal((await handleHoEditorialRequest(req(q,"GET",undefined,{token:"expired"}),env())).status,401);
 for(const host of ["https://bo.staging.pinohouse.art","https://tos.staging.pinohouse.art","https://ho.pinohouse.art","http://ho.staging.pinohouse.art"])assert.equal((await handleHoEditorialRequest(req(q,"GET",undefined,{host}),env())).status,404);
 assert.equal((await handleHoEditorialRequest(req(q,"GET",undefined,{hostHeader:"bo.staging.pinohouse.art"}),env())).status,404);
 assert.equal((await handleHoEditorialRequest(req("/decision"),env())).status,405);
 assert.equal(calls.length,0);
});
