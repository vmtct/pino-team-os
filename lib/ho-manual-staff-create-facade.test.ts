// PAP-2358 · WFM-STAFF. No real login or write.
import test from "node:test";
import assert from "node:assert/strict";
import { parseHoManualStaffCommand, parseHoManualStaffReceipt } from "./ho-manual-staff-create-facade";
const id=(n:number)=>"01912345-6789-7abc-8def-"+String(n).padStart(12,"0");
const command={name:" Synthetic Staff ",phone:"0912345678",email:"Staff@Example.invalid",gender:null,birthDate:null,centerId:id(1),login:null};
test("record only command is normalized without login",()=>{
 assert.deepEqual(parseHoManualStaffCommand(command),{...command,name:"Synthetic Staff",email:"staff@example.invalid"});
});
test("optional login is bound to primary email and password policy",()=>{
 const login={email:"STAFF@example.invalid",password:"synthetic-password"};
 assert.deepEqual(parseHoManualStaffCommand({...command,login})?.login,{...login,email:"staff@example.invalid"});
 for(const value of [{...login,email:"other@example.invalid"},{...login,password:"short"},{...login,roleId:id(5)},{}])
  assert.equal(parseHoManualStaffCommand({...command,login:value}),null);
});
test("strict shape rejects role, scope, identity, malformed center and invalid date",()=>{
 for(const value of [null,[],{}, {...command,roleId:id(2)}, {...command,scope:"GLOBAL"}, {...command,existingPersonId:id(3)},
  {...command,status:"active"}, {...command,centerId:"forged"}, {...command,birthDate:"2026-02-30"}, {...command,phone:"bad"}])
  assert.equal(parseHoManualStaffCommand(value),null);
});
const receipt={staffMemberId:id(2),personId:id(3),membershipId:id(4),centerId:id(1),accessState:"NOT_PROVISIONED"};
test("record-only receipt projects exact canonical references",()=>{
 assert.deepEqual(parseHoManualStaffReceipt({data:receipt},id(1),false),receipt);
 for(const value of [{...receipt,centerId:id(9)},{...receipt,password:"synthetic"},{...receipt,accessUserId:id(5)}, {...receipt,staffMemberId:"fake"}])
  assert.equal(parseHoManualStaffReceipt({data:value},id(1),false),null);
});
test("opt-in receipt requires both account IDs and matching branch",()=>{
 const account={...receipt,accessState:"PROVISIONED",accessUserId:id(5),assignmentId:id(6)};
 assert.deepEqual(parseHoManualStaffReceipt({data:account},id(1),true),account);
 assert.equal(parseHoManualStaffReceipt({data:account},id(1),false),null);
 assert.equal(parseHoManualStaffReceipt({data:receipt},id(1),true),null);
 assert.equal(parseHoManualStaffReceipt({data:{...account,assignmentId:null}},id(1),true),null);
});

import { handleHoManualStaffCreate, handleHoManualStaffReceipt, type HoManualStaffCreateEnv } from "./ho-manual-staff-create-facade";
import { HO_STAGING_HOSTNAME } from "./host-boundary";
import type { BoAccessRequest } from "./bo-core";

function bindingFixture(options:{founder?:boolean;admitted?:boolean;status?:number;response?:unknown}={}){
 const calls:BoAccessRequest[]=[];
 const env:HoManualStaffCreateEnv={APP_ENV:"staging",HO_PILOT_FOUNDER_USER_IDS:"qa-founder",PINO_BO_CORE:{
  async executeWithStaffPassword(request,token){
   calls.push(request);
   if(token!=="synthetic-session")return {status:401,body:{},requestId:"qa"};
   if(request.path==="context")return {status:200,body:{data:{userId:options.founder===false?"qa-other":"qa-founder",email:"qa@example.invalid",surface:"BO",entitled:true}},requestId:"qa"};
   if(request.path==="ho/admission")return {status:options.admitted===false?403:200,body:{data:{admitted:options.admitted!==false}},requestId:"qa"};
   return {status:options.status??201,body:options.response??{data:receipt},requestId:"qa"};
  },
 }};
 return {env,calls};
}
function bffRequest(overrides:{method?:string;host?:string;origin?:string;cookie?:string;key?:string;path?:string;body?:unknown}={}){
 const host=overrides.host??HO_STAGING_HOSTNAME,method=overrides.method??"POST";
 return new Request("https://"+host+(overrides.path??"/api/ho/staff/create"),{
  method,headers:{host,origin:overrides.origin??"https://"+HO_STAGING_HOSTNAME,
   "content-type":"application/json","idempotency-key":overrides.key??"qa-create-123",cookie:overrides.cookie??"pino_staff_password_session=synthetic-session"},
  ...(method==="POST"?{body:JSON.stringify(overrides.body??command)}:{}),
 });
}
test("actual BFF admission delegates one exact command and projects no-store receipt",async()=>{
 const f=bindingFixture(),response=await handleHoManualStaffCreate(bffRequest(),f.env);
 assert.equal(response.status,201);assert.equal(response.headers.get("cache-control"),"no-store");
 assert.deepEqual(await response.json(),{data:receipt});
 assert.deepEqual(f.calls.map(r=>r.path),["context","ho/admission","ho/workforce/manual-staff/create"]);
 assert.deepEqual(f.calls[2],{method:"POST",path:"ho/workforce/manual-staff/create",idempotencyKey:"qa-create-123",body:{...command,name:"Synthetic Staff",email:"staff@example.invalid"}});
});
test("reject staging host, origin, method, query, key without Core invocation",async()=>{
 for(const [overrides,status] of [[{host:"other.example.invalid"},404],[{origin:"https://other.example.invalid"},403],[{method:"GET"},405],[{path:"/api/ho/staff/create?center=forged"},404],[{key:"bad"},400]] as const){
  const f=bindingFixture();assert.equal((await handleHoManualStaffCreate(bffRequest(overrides),f.env)).status,status);assert.equal(f.calls.length,0);
 }
 const f=bindingFixture();assert.equal((await handleHoManualStaffCreate(bffRequest(),{...f.env,APP_ENV:"production"})).status,404);assert.equal(f.calls.length,0);
});
test("missing session, non-Founder and revoked Founder proof cannot reach write",async()=>{
 const missing=bindingFixture();assert.equal((await handleHoManualStaffCreate(bffRequest({cookie:""}),missing.env)).status,401);assert.equal(missing.calls.length,0);
 for(const options of [{founder:false},{admitted:false}]){
  const f=bindingFixture(options);assert.equal((await handleHoManualStaffCreate(bffRequest(),f.env)).status,403);assert.ok(f.calls.every(r=>r.method==="GET"));
 }
});
test("malformed commands stop before write; Core errors are scrubbed and mismatched receipt rejected",async()=>{
 const bad=bindingFixture();assert.equal((await handleHoManualStaffCreate(bffRequest({body:{...command,roleId:id(9)}}),bad.env)).status,400);assert.ok(bad.calls.every(r=>r.method==="GET"));
 const error=bindingFixture({status:409,response:{error:{message:"synthetic-sensitive-detail"}}});const denied=await handleHoManualStaffCreate(bffRequest(),error.env);
 assert.equal(denied.status,409);assert.deepEqual(await denied.json(),{error:{code:"HO_STAFF_CREATION_CONFLICT"}});
 const mismatch=bindingFixture({response:{data:{...receipt,centerId:id(9)}}});assert.equal((await handleHoManualStaffCreate(bffRequest(),mismatch.env)).status,502);
});

const receiptRequest=(overrides:Parameters<typeof bffRequest>[0]={})=>bffRequest({path:"/api/ho/staff/create/receipt",body:{centerId:id(1)},...overrides});
test("receipt BFF calls exact admitted readback and projects historical result",async()=>{
 const f=bindingFixture({status:200,response:{data:{state:"COMMITTED",receipt}}});
 const response=await handleHoManualStaffReceipt(receiptRequest(),f.env);
 assert.equal(response.status,200);assert.equal(response.headers.get("cache-control"),"no-store");
 assert.deepEqual(await response.json(),{data:{state:"COMMITTED",receipt}});
 assert.deepEqual(f.calls.map(r=>r.path),["context","ho/admission","ho/workforce/manual-staff/create/receipt"]);
 assert.deepEqual(f.calls[2],{method:"POST",path:"ho/workforce/manual-staff/create/receipt",body:{centerId:id(1)},idempotencyKey:"qa-create-123"});
 const missing=bindingFixture({status:200,response:{data:{state:"NOT_OBSERVED"}}});
 assert.deepEqual(await (await handleHoManualStaffReceipt(receiptRequest(),missing.env)).json(),{data:{state:"NOT_OBSERVED"}});
});
test("receipt BFF rejects unauthorized requests, extra profile and malformed historical result",async()=>{
 for(const [overrides,status] of [[{method:"GET"},405],[{origin:"https://wrong.invalid"},403],[{path:"/api/ho/staff/create/receipt?key=bad"},404],[{cookie:""},401],[{body:{centerId:id(1),password:"synthetic"}},400]] as const){
  const f=bindingFixture();assert.equal((await handleHoManualStaffReceipt(receiptRequest(overrides),f.env)).status,status);
  assert.ok(f.calls.every(r=>r.method==="GET"));
 }
 const f=bindingFixture({admitted:false});assert.equal((await handleHoManualStaffReceipt(receiptRequest(),f.env)).status,403);assert.ok(f.calls.every(r=>r.method==="GET"));
 for(const result of [{state:"COMMITTED",receipt:{...receipt,centerId:id(9)}},{state:"COMMITTED",receipt:{...receipt,password:"synthetic"}},{state:"NOT_OBSERVED",fingerprint:"synthetic"}]){
  const bad=bindingFixture({status:200,response:{data:result}});assert.equal((await handleHoManualStaffReceipt(receiptRequest(),bad.env)).status,502);
 }
});
