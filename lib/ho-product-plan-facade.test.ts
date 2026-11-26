import test from "node:test";
import assert from "node:assert/strict";
import {handleHoProductPlans} from "./ho-product-plan-facade";
import type {HoEnv} from "./ho-auth";
import {planHost,planActorHeader,planRequest,parseCatalogBody,createPlanBrowserPort} from "../app/ho/billing/product-plans/product-plan-http-contract";
import {catalogPath} from "../app/ho/billing/product-plans/product-plan-native-contract";
const actor="01900000-0000-7000-8000-000000000001",id="01900000-0000-7000-8000-000000000002",other="01900000-0000-7000-8000-000000000003";
const at="2026-11-26T00:00:00.000Z",origin="https://"+planHost;
const dto={id,displayName:"Gói học",createdByUserId:null,updatedByUserId:actor,cadence:1,termWeeks:12,purchasedUnits:12,listPriceMinor:100,currency:"VND",enabled:true,badge:"STANDARD",createdAt:at,updatedAt:at,version:2,private:"never"};
const grants=["team.bo.access","billing.view","billing.manage"];
function setup(options:{admitted?:boolean;secondActor?:string;permissionKeys?:string[]}={}){
 let contexts=0;const calls:{method:string;path:string;body?:unknown}[]=[];
 const env:HoEnv={APP_ENV:"staging",HO_PILOT_FOUNDER_USER_IDS:actor,PINO_BO_CORE:{async executeWithStaffPassword(req,token){
  if(token!=="synthetic")return {status:401,body:{},requestId:"test"};
  if(req.path==="context")return {status:200,body:{data:{userId:++contexts>1?options.secondActor??actor:actor,email:"fixture@example.invalid",surface:"BO",entitled:true,permissionKeys:options.permissionKeys??grants}},requestId:"test"};
  if(req.path==="ho/admission")return {status:options.admitted===false?403:200,body:{data:{admitted:options.admitted!==false}},requestId:"test"};
  calls.push(req);return {status:200,body:{data:req.path==="ho/billing/product-plans"?[dto]:dto},requestId:"test"};
 }}};
 return {env,calls};
}
function req(suffix="",method="GET",body:unknown={expectedVersion:1,listPriceMinor:100},headers:Record<string,string>={}){
 return new Request(origin+catalogPath+suffix,{method,headers:{host:planHost,cookie:"pino_staff_password_session=synthetic",[planActorHeader]:actor,origin,"content-type":"application/json",...headers},...(method==="PATCH"?{body:JSON.stringify(body)}:{})});
}
test("exact path and query grammar, only six patch fields",()=>{
 for(const [p,m] of [[catalogPath,"GET"],[catalogPath+"/"+id,"PATCH"],[catalogPath+"/"+id+"/subscriptions?limit=100&after="+other,"GET"]])assert.ok(planRequest(p,m));
 for(const [p,m] of [[catalogPath,"PATCH"],[catalogPath+"/"+id,"DELETE"],[catalogPath+"/"+id+"?limit=1","GET"],[catalogPath+"/"+id+"/history?limit=101","GET"],[catalogPath+"/"+id+"/history?limit=1&limit=2","GET"],[catalogPath+"/"+id+"/history?actor="+actor,"GET"]])assert.equal(planRequest(p,m),null);
 assert.deepEqual(parseCatalogBody({expectedVersion:1,displayName:" A ",enabled:false}),{expectedVersion:1,displayName:"A",enabled:false});
 assert.equal(parseCatalogBody({expectedVersion:1,actorId:actor}),null);
});
test("authenticated exact Core read and PATCH; no raw extra payload",async()=>{
 const {env,calls}=setup();
 for(const [suffix,method] of [["","GET"],["/"+id,"GET"],["/"+id,"PATCH"]]){
  const response=await handleHoProductPlans(req(suffix,method),env);assert.equal(response.status,200);assert.doesNotMatch(await response.text(),/private|never/);
 }
 assert.deepEqual(calls.map(r=>[r.method,r.path]),[["GET","ho/billing/product-plans"],["GET","ho/billing/product-plans/"+id],["PATCH","ho/billing/product-plans/"+id]]);
 assert.deepEqual(calls.at(-1)?.body,{expectedVersion:1,listPriceMinor:100});
});
test("denies principal mismatch, missing session, grants, non-Founder and wrong ingress before dispatch",async()=>{
 for(const options of [{admitted:false},{secondActor:other},{permissionKeys:["team.bo.access","billing.view"]}]){
  const {env,calls}=setup(options);assert.equal((await handleHoProductPlans(req("/"+id,"PATCH"),env)).status,403);assert.equal(calls.length,0);
 }
 const {env,calls}=setup();
 for(const [headers,status] of [[{cookie:""},401],[{[planActorHeader]:other},403],[{[planActorHeader]:""},403],[{origin:"https://evil.invalid"},403],[{host:"bo.staging.pinohouse.art"},404]] as const)
  assert.equal((await handleHoProductPlans(req("/"+id,"PATCH",undefined,headers),env)).status,status);
 assert.equal((await handleHoProductPlans(req("/"+id,"PATCH",{expectedVersion:1,actorId:actor}),env)).status,400);
 assert.equal((await handleHoProductPlans(req(),{...env,APP_ENV:"production"})).status,404);assert.equal(calls.length,0);
});
test("browser port sends only same-origin exact method and actor fence, no credentials in headers",async()=>{
 let calls=0;const port=createPlanBrowserPort(actor,origin,async(input,init)=>{
  calls++;assert.equal(input,catalogPath+"/"+id);assert.equal(init?.credentials,"same-origin");assert.equal(init?.redirect,"error");
  const headers=new Headers(init?.headers);assert.equal(headers.get(planActorHeader),actor);assert.equal(headers.has("authorization"),false);assert.equal(headers.has("cookie"),false);
  return Response.json({data:dto});
 });
 const signal=new AbortController().signal;
 assert.equal((await port(catalogPath+"/"+id,{method:"PATCH",body:{expectedVersion:1,listPriceMinor:100},signal})).status,200);
 await assert.rejects(port("https://evil.invalid"+catalogPath,{method:"GET",signal}));assert.equal(calls,1);
 assert.throws(()=>createPlanBrowserPort(actor,"https://evil.invalid"));
});
