import test from "node:test";
import assert from "node:assert/strict";
import {handleHoWorldRequest,type HoWorldEnv} from "./ho-world-handler";
const base="https://ho.staging.pinohouse.art",path="/api/ho/pinoria/worlds";
const body={key:"test-world",displayName:"Test World",worldType:"CORE",descriptionText:""};
const calls:unknown[]=[];
function env(options:{founder?:boolean;grant?:boolean;binding?:boolean;configured?:boolean}={}):HoWorldEnv {
 const {founder=true,grant=true,binding=true,configured=true}=options;
 return {APP_ENV:configured?"staging":"production",HO_PILOT_FOUNDER_USER_IDS:"founder",PINO_BO_CORE:{
 async executeWithStaffPassword(request,token){
 if(token!=="valid")return {status:401,requestId:"qa",body:{error:{code:"AUTH_REQUIRED"}}};
 if(request.path==="ho/admission")return {status:founder?200:403,requestId:"qa",body:{data:{admitted:founder}}};
 assert.equal(request.path,"context");
 return {status:200,requestId:"qa",body:{data:{userId:founder?"founder":"manager",email:"qa@example.invalid",surface:"BO",entitled:true,permissionKeys:grant?["team.bo.access","pinoria.world.view","pinoria.world.manage"]:["team.bo.access"]}}};
 }},...(binding?{PINO_HO_WORLD_CORE:{async executeWithStaffPassword(r,token){calls.push({r,token});return {status:r.method==="POST"?201:200,requestId:"world-qa",body:{data:{}}}}}}:{})};
}
function req(method="GET",url=base+path,token="valid",b:unknown=undefined,key="create-qa-1"){return new Request(url,{method,headers:{host:new URL(url).hostname,cookie:"pino_staff_password_session="+token,"content-type":"application/json","idempotency-key":key},body:b===undefined?undefined:JSON.stringify(b)});}
test("exact staging HO catalog path and GET/POST only",async()=>{calls.length=0;for(const host of ["bo.staging.pinohouse.art","tos.staging.pinohouse.art","ho.pinohouse.art"])assert.equal((await handleHoWorldRequest(req("GET","https://"+host+path),env())).status,404);for(const suffix of ["/x","/media","?x=1"])assert.equal((await handleHoWorldRequest(req("GET",base+path+suffix),env())).status,404);for(const m of ["PATCH","DELETE","PUT"])assert.equal((await handleHoWorldRequest(req(m),env())).status,405);assert.equal(calls.length,0);});
test("Founder, session, global action permission and private binding fail closed",async()=>{calls.length=0;for(const options of [{founder:false},{grant:false},{configured:false},{binding:false}])assert.equal((await handleHoWorldRequest(req("POST",base+path,"valid",body),env(options))).status,options.configured===false?404:options.binding===false?503:403);assert.equal((await handleHoWorldRequest(req("GET",base+path,"expired"),env())).status,401);assert.equal(calls.length,0);});
test("valid read and create use bounded exact private RPC",async()=>{calls.length=0;assert.equal((await handleHoWorldRequest(req(),env())).status,200);const r=await handleHoWorldRequest(req("POST",base+path,"valid",body),env());assert.equal(r.status,201);assert.equal(r.headers.get("x-request-id"),"world-qa");assert.deepEqual(calls,[{r:{method:"GET",path:"pinoria/worlds"},token:"valid"},{r:{method:"POST",path:"pinoria/worlds",body,idempotencyKey:"create-qa-1"},token:"valid"}]);});
test("missing key, malformed/oversize and overposted values never reach Core",async()=>{calls.length=0;assert.equal((await handleHoWorldRequest(req("POST",base+path,"valid",body,""),env())).status,400);assert.equal((await handleHoWorldRequest(req("POST",base+path,"valid",{...body,status:"ACTIVE"}),env())).status,400);assert.equal((await handleHoWorldRequest(req("POST",base+path,"valid",{...body,displayName:"a".repeat(5000)}),env())).status,413);assert.equal(calls.length,0);});
