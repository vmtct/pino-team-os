import test from "node:test";
import assert from "node:assert/strict";
import {handleHoLearningSpaceRequest} from "./ho-learning-space-handler";
import type {HoWorldEnv} from "./ho-world-handler";
const base="https://ho.staging.pinohouse.art",path="/api/ho/learning-spaces",id="019d2170-0000-7000-8000-000000000001",center="019d2170-0000-7000-8000-000000000002",key="qa-space-attempt";
const body={centerId:center,code:"studio",displayName:"Studio",optimalConcurrentCapacity:8,hardConcurrentCapacity:null,status:"ACTIVE"};
const calls:unknown[]=[];
function env(o:{founder?:boolean;grant?:boolean;binding?:boolean;staging?:boolean;status?:number}={}):HoWorldEnv{
 return {APP_ENV:o.staging===false?"production":"staging",HO_PILOT_FOUNDER_USER_IDS:"founder",PINO_BO_CORE:{async executeWithStaffPassword(r,token){
 if(token!=="valid")return {status:401,requestId:"qa",body:{error:{code:"AUTH_REQUIRED"}}};
 if(r.path==="ho/admission")return {status:o.founder===false?403:200,requestId:"qa",body:{data:{admitted:o.founder!==false}}};
 assert.equal(r.path,"context");return {status:200,requestId:"qa",body:{data:{userId:o.founder===false?"manager":"founder",email:"qa@example.invalid",surface:"BO",entitled:true,permissionKeys:o.grant===false?["team.bo.access"]:["team.bo.access","delivery.schedule.manage"]}}};
 }},...(o.binding===false?{}:{PINO_HO_WORLD_CORE:{async executeWithStaffPassword(r,token){calls.push({r,token});return {status:o.status??(r.method==="POST"?201:200),requestId:"space-qa",body:o.status?{error:{message:"private diagnostic"}}:{data:{}}};}}})};
}
function req(suffix="",method="GET",b?:unknown,opts:{host?:string;token?:string;origin?:string;key?:string}={}){
 const host=opts.host??base;
 return new Request(host+path+suffix,{method,headers:{host:new URL(host).hostname,cookie:"pino_staff_password_session="+(opts.token??"valid"),...(method==="GET"?{}:{origin:opts.origin??host,"content-type":"application/json","idempotency-key":opts.key??key})},body:b===undefined?undefined:JSON.stringify(b)});
}
test("exact read namespace, query and private RPC",async()=>{
 calls.length=0;for(const s of ["?limit=100","/"+id,"/"+id+"/classes?limit=100","/"+id+"/history?after="+id])assert.equal((await handleHoLearningSpaceRequest(req(s),env())).status,200);
 assert.deepEqual(calls.map(x=>(x as {r:{path:string}}).r.path),["ho/learning-spaces?limit=100","ho/learning-spaces/"+id,"ho/learning-spaces/"+id+"/classes?limit=100","ho/learning-spaces/"+id+"/history?after="+id]);calls.length=0;
 for(const s of ["/bad","/"+id+"/extra","?limit=101","?limit=1&limit=2","?unknown=x","/"+id+"?q=x"])assert.ok([400,404].includes((await handleHoLearningSpaceRequest(req(s),env())).status));assert.equal(calls.length,0);
});
test("exact commands, origin, no-store and typed conflict",async()=>{
 calls.length=0;const r=await handleHoLearningSpaceRequest(req("","POST",body),env());assert.equal(r.status,201);assert.equal(r.headers.get("cache-control"),"private, no-store");
 assert.equal((await handleHoLearningSpaceRequest(req("/"+id,"PATCH",{...body,expectedVersion:1}),env())).status,200);
 assert.equal((await handleHoLearningSpaceRequest(req("/"+id,"DELETE",{centerId:center,expectedVersion:2}),env())).status,200);
 assert.deepEqual(calls,[{r:{method:"POST",path:"ho/learning-spaces",body,idempotencyKey:key},token:"valid"},{r:{method:"PATCH",path:"ho/learning-spaces/"+id,body:{...body,expectedVersion:1},idempotencyKey:key},token:"valid"},{r:{method:"DELETE",path:"ho/learning-spaces/"+id,body:{centerId:center,expectedVersion:2},idempotencyKey:key},token:"valid"}]);
 const conflict=await handleHoLearningSpaceRequest(req("/"+id,"PATCH",{...body,expectedVersion:1}),env({status:409}));assert.equal(conflict.status,409);assert.ok(!(await conflict.text()).includes("private diagnostic"));
});
test("Founder, permission, host, session and invalid bodies fail closed",async()=>{
 calls.length=0;for(const [o,s] of [[{founder:false},403],[{grant:false},403],[{binding:false},503],[{staging:false},404]] as const)assert.equal((await handleHoLearningSpaceRequest(req("","POST",body),env(o))).status,s);
 assert.equal((await handleHoLearningSpaceRequest(req("","GET",undefined,{token:"expired"}),env())).status,401);
 for(const host of ["https://bo.staging.pinohouse.art","https://tos.staging.pinohouse.art","https://ho.pinohouse.art"])assert.equal((await handleHoLearningSpaceRequest(req("","GET",undefined,{host}),env())).status,404);
 assert.equal((await handleHoLearningSpaceRequest(req("","POST",body,{origin:"https://other.invalid"}),env())).status,403);
 assert.equal((await handleHoLearningSpaceRequest(req("","POST",body,{key:""}),env())).status,400);
 for(const b of [{...body,resource:"x"},{...body,optimalConcurrentCapacity:0},{...body,hardConcurrentCapacity:2},{...body,status:"UNKNOWN"}])assert.equal((await handleHoLearningSpaceRequest(req("","POST",b),env())).status,400);
 assert.equal((await handleHoLearningSpaceRequest(req("","POST",{...body,displayName:"a".repeat(5000)}),env())).status,413);assert.equal(calls.length,0);
});
