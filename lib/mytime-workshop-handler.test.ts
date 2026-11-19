import {test} from "node:test";
import assert from "node:assert/strict";
import {handleMyTimeWorkshop,type WorkshopEnv} from "./mytime-workshop-handler";
import type {BoAccessRequest} from "./bo-core";
import type {FounderRequest} from "./founder-core";
const ho="ho.staging.pinohouse.art",bo="bo.staging.pinohouse.art",base="learning/mytime-workshops",id="01a03c6e-cc58-7d81-ac8e-123456789abc",key="workshop-test-command-123";
function fixture(opts:{founder?:boolean;grant?:boolean;write?:boolean;stage?:boolean;binding?:boolean}={}){
 const calls:({surface:"HO";request:FounderRequest}|{surface:"BO";request:BoAccessRequest})[]=[];
 const env:WorkshopEnv={APP_ENV:opts.stage===false?"production":"staging",HO_PILOT_FOUNDER_USER_IDS:id,
 PINO_BO_CORE:{async executeWithStaffPassword(request,token){
  if(token!=="synthetic")return {status:401,requestId:"qa",body:{error:{code:"AUTH_REQUIRED"}}};
  if(request.path==="context")return {status:200,requestId:"qa",body:{data:{userId:id,email:"qa@example.invalid",surface:"BO",entitled:true,permissionKeys:["team.bo.access",...(opts.grant===false?[]:["learning.mytime_workshop.ho_view",...(opts.write===false?[]:["learning.mytime_workshop.ho_manage"])])]}}};
  if(request.path==="ho/admission")return {status:opts.founder===false?403:200,requestId:"qa",body:{data:{admitted:opts.founder!==false}}};
  calls.push({surface:"BO",request});return {status:200,requestId:"qa",body:{data:{scopeCenterId:request.resource?.centerId,events:[],nextBeforeId:null}}};
 }},
 ...(opts.binding===false?{}:{PINO_CORE:{async executeWithStaffPassword(request:FounderRequest,token:string){assert.equal(token,"synthetic");calls.push({surface:"HO",request});return {status:request.method==="POST"?201:200,requestId:"qa",body:{data:{}}};}}})};
 return {env,calls};
}
function req(surface:"HO"|"BO",method="GET",suffix="",body?:unknown,extra:Record<string,string>={}){
 const host=surface==="HO"?ho:bo,url="https://"+host+"/api/"+surface.toLowerCase()+"/"+base+suffix;
 return new Request(url,{method,headers:{host,cookie:"pino_staff_password_session=synthetic",origin:"https://"+host,"sec-fetch-site":"same-origin","content-type":"application/json","idempotency-key":key,...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
}
test("PAP-2164 actual facade BO only GET explicit canonical Center, deny wrong scope, methods and directory before RPC",async()=>{
 const {env,calls}=fixture();
 const r=await handleMyTimeWorkshop(req("BO","GET","?centerId="+id+"&limit=1"),env,"BO");
 assert.equal(r.status,200);assert.equal(r.headers.get("cache-control"),"no-store");
 assert.deepEqual(calls,[{surface:"BO",request:{method:"GET",path:base+"?centerId="+id+"&limit=1",resource:{centerId:id}}}]);calls.length=0;
 for(const [method,suffix,status] of [["GET","",400],["GET","?centerId="+id+"&centerId="+id,400],["GET","?centerId="+id+"&limit=101",400],["GET","/lookup/staff?centerId="+id,405],["POST","?centerId="+id,405],["PATCH","/"+id+"?centerId="+id,405]] as const)assert.equal((await handleMyTimeWorkshop(req("BO",method,suffix),env,"BO")).status,status);
 assert.equal((await handleMyTimeWorkshop(req("BO","GET","?centerId="+id,undefined,{cookie:""}),env,"BO")).status,401);
 assert.equal((await handleMyTimeWorkshop(req("BO","GET","?centerId="+id,undefined,{cookie:"pino_staff_password_session=synthetic; pino_support_session=synthetic"}),env,"BO")).status,403);
 assert.equal(calls.length,0);
});
test("PAP-2164 HO requires actual founder and explicit read/manage, exact command forwards stable key",async()=>{
 for(const [opts,status] of [[{founder:false},403],[{grant:false},403],[{write:false},403],[{stage:false},404],[{binding:false},503]] as const){
  const {env,calls}=fixture(opts);assert.equal((await handleMyTimeWorkshop(req("HO","POST","",{name:"QA"}),env,"HO")).status,status);assert.equal(calls.length,0);
 }
 const {env,calls}=fixture();
 assert.equal((await handleMyTimeWorkshop(req("HO","GET","/lookup/staff?limit=1"),env,"HO")).status,200);
 assert.equal((await handleMyTimeWorkshop(req("HO","PATCH","/"+id,{name:"Changed",expectedVersion:1}),env,"HO")).status,200);
 assert.equal((await handleMyTimeWorkshop(req("HO","POST","/"+id+"/cancel",{expectedVersion:2}),env,"HO")).status,201);
 assert.deepEqual(calls,[{surface:"HO",request:{method:"GET",path:base+"/lookup/staff?limit=1"}},{surface:"HO",request:{method:"PATCH",path:base+"/"+id,body:{name:"Changed",expectedVersion:1},idempotencyKey:key}},{surface:"HO",request:{method:"POST",path:base+"/"+id+"/cancel",body:{expectedVersion:2},idempotencyKey:key}}]);
});
test("PAP-2164 facade rejects invalid origin, overposting, unknown paths and payload before private RPC",async()=>{
 const {env,calls}=fixture();
 for(const [r,status] of [[req("HO","POST","",{name:"QA"},{origin:"https://other.invalid"}),403],[req("HO","POST","",{name:"QA"},{"idempotency-key":""}),400],[req("HO","POST","",{name:"QA",createdBy:id}),400],[req("HO","POST","",{name:"x".repeat(33000)}),400],[req("HO","PATCH","/"+id,{name:"QA",expectedVersion:0}),400],[req("HO","GET","/"+id+"/cancel"),405],[req("HO","GET","/unknown"),404],[req("HO","GET","?centerId="+id),400]] as const)assert.equal((await handleMyTimeWorkshop(r,env,"HO")).status,status);
 assert.equal(calls.length,0);
});
