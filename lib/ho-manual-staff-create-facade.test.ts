// PAP-2358 · WFM-STAFF. No real login or write.
import test from "node:test";
import assert from "node:assert/strict";
import { parseHoManualStaffCommand, parseHoManualStaffReceipt } from "./ho-manual-staff-create-facade";
const id=(n:number)=>"01912345-6789-7abc-8def-"+String(n).padStart(12,"0");
const command={name:" Synthetic Staff ",phone:"0912345678",email:"Staff@Example.invalid",gender:null,birthDate:null,centerId:id(1)};
test("record only command is normalized without login",()=>{
 assert.deepEqual(parseHoManualStaffCommand(command),{...command,name:"Synthetic Staff",email:"staff@example.invalid"});
});
test("phase1 rejects login even null, and all role or credential intents",()=>{
 for(const login of [null,{email:"staff@example.invalid",password:"synthetic-password"},{}])assert.equal(parseHoManualStaffCommand({...command,login}),null);
});
test("strict shape rejects role, scope, identity, malformed center and invalid date",()=>{
 for(const value of [null,[],{}, {...command,roleId:id(2)}, {...command,scope:"GLOBAL"}, {...command,existingPersonId:"invalid"}, {...command,existingPersonId:null}, {...command,existingPersonId:"01912345-6789-4abc-8def-000000000003"},
  {...command,status:"active"}, {...command,centerId:"forged"}, {...command,birthDate:"2026-02-30"}, {...command,phone:"bad"}])
  assert.equal(parseHoManualStaffCommand(value),null);
});
const receipt={staffMemberId:id(2),personId:id(3),membershipId:id(4),centerId:id(1),initialStaffStatus:"inactive" as const,accessState:"NOT_PROVISIONED"};
test("record-only receipt projects exact canonical references",()=>{
 assert.deepEqual(parseHoManualStaffReceipt({data:receipt},id(1),false),receipt);
 for(const value of [{...receipt,centerId:id(9)},{...receipt,password:"synthetic"},{...receipt,accessUserId:id(5)}, {...receipt,staffMemberId:"fake"}])
  assert.equal(parseHoManualStaffReceipt({data:value},id(1),false),null);
});
test("opt-in receipt requires both account IDs and matching branch",()=>{
 const account={...receipt,accessState:"PROVISIONED",accessUserId:id(5),assignmentId:id(6)};
 assert.equal(parseHoManualStaffReceipt({data:account},id(1),true),null);
 assert.equal(parseHoManualStaffReceipt({data:{...receipt,initialStaffStatus:null}},id(1),false),null);
 assert.equal(parseHoManualStaffReceipt({data:account},id(1),false),null);
 assert.equal(parseHoManualStaffReceipt({data:receipt},id(1),true),null);
 assert.equal(parseHoManualStaffReceipt({data:{...account,assignmentId:null}},id(1),true),null);
});

import { handleHoManualStaffCreate, handleHoManualStaffReceipt, handleHoManualStaffDirectory, type HoManualStaffCreateEnv } from "./ho-manual-staff-create-facade";
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
function bffRequest(overrides:{method?:string;host?:string;origin?:string;cookie?:string;key?:string;path?:string;body?:unknown;principal?:string}={}){
 const host=overrides.host??HO_STAGING_HOSTNAME,method=overrides.method??"POST";
 return new Request("https://"+host+(overrides.path??"/api/ho/staff/create"),{
  method,headers:{host,origin:overrides.origin??"https://"+HO_STAGING_HOSTNAME,
   "x-pino-expected-staff-principal":overrides.principal??"qa-founder","content-type":"application/json","idempotency-key":overrides.key??"qa-create-123",cookie:overrides.cookie??"pino_staff_password_session=synthetic-session"},
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

const nativeRow={id:id(2),displayLabel:"Synthetic Staff",status:"active",roleLabel:null,createdAt:"2026-11-25T00:00:00Z",updatedAt:"2026-11-25T00:00:00Z",createdByUserId:null,updatedByUserId:null};
const directoryRequest=(path="/api/ho/staff/directory",cookie="pino_staff_password_session=synthetic-session",host=HO_STAGING_HOSTNAME,method="GET")=>new Request("https://"+host+path,{method,headers:{host,cookie}});
test("native directory BFF reads exact list and detail after actual admission",async()=>{
 const f=bindingFixture({status:200,response:{data:[nativeRow]}});
 const response=await handleHoManualStaffDirectory(directoryRequest(),f.env);
 assert.equal(response.status,200);assert.equal(response.headers.get("cache-control"),"no-store");
 assert.deepEqual(await response.json(),{data:[nativeRow]});
 assert.deepEqual(f.calls[2],{method:"GET",path:"ho/workforce/manual-staff/directory"});
 const detail={...nativeRow,mobile:null,email:null,gender:null,birthDate:null,loginEmail:null,centers:[]};
 const g=bindingFixture({status:200,response:{data:detail}});
 assert.equal((await handleHoManualStaffDirectory(directoryRequest("/api/ho/staff/directory/"+id(2)),g.env)).status,200);
 assert.equal(g.calls[2]?.path,"ho/workforce/manual-staff/directory/"+id(2));
});
test("directory BFF rejects unauthorized paths and malformed Core projections",async()=>{
 for(const [req,status] of [[directoryRequest("/api/ho/staff/directory?center=x"),404],[directoryRequest("/api/ho/staff/directory/STAFF-MOCK-001"),404],[directoryRequest(undefined,undefined,"other.invalid"),404],[directoryRequest(undefined,undefined,undefined,"POST"),405],[directoryRequest(undefined,""),401]] as const){
   const f=bindingFixture();assert.equal((await handleHoManualStaffDirectory(req,f.env)).status,status);assert.equal(f.calls.length,0);
 }
 const deny=bindingFixture({admitted:false});assert.equal((await handleHoManualStaffDirectory(directoryRequest(),deny.env)).status,403);
 assert.ok(deny.calls.every(r=>r.path==="context"||r.path==="ho/admission"));
 for(const data of [[nativeRow,nativeRow],[{...nativeRow,password:"synthetic"}],[{...nativeRow,id:"fake"}]]){
   const f=bindingFixture({status:200,response:{data}});assert.equal((await handleHoManualStaffDirectory(directoryRequest(),f.env)).status,502);
 }
});

test("explicit canonical Person is forwarded and receipt must match selected identity",async()=>{
 const selected={...command,existingPersonId:id(3)};
 assert.equal(parseHoManualStaffCommand(selected)?.existingPersonId,id(3));
 const f=bindingFixture();
 assert.equal((await handleHoManualStaffCreate(bffRequest({body:selected}),f.env)).status,201);
 assert.deepEqual(f.calls[2]?.body,{...selected,name:"Synthetic Staff",email:"staff@example.invalid"});
 const mismatch=bindingFixture({response:{data:{...receipt,personId:id(8)}}});
 assert.equal((await handleHoManualStaffCreate(bffRequest({body:selected}),mismatch.env)).status,502);
});

test("PAP-2395 stale or missing expected principal never dispatches a command or receipt",async()=>{
 for(const principal of ["","qa-stale","qa-founder,qa-stale"]){
  const f=bindingFixture();assert.equal((await handleHoManualStaffCreate(bffRequest({principal}),f.env)).status,403);assert.ok(f.calls.every(r=>r.method==="GET"));
  const g=bindingFixture();assert.equal((await handleHoManualStaffReceipt(receiptRequest({principal}),g.env)).status,403);assert.ok(g.calls.every(r=>r.method==="GET"));
 }
 const h=bindingFixture();const req=new Request("https://"+HO_STAGING_HOSTNAME+"/api/ho/staff/directory/"+id(2),{headers:{host:HO_STAGING_HOSTNAME,cookie:"pino_staff_password_session=synthetic-session","x-pino-expected-staff-principal":"qa-stale"}});
 assert.equal((await handleHoManualStaffDirectory(req,h.env)).status,403);assert.ok(h.calls.every(r=>r.path==="context"||r.path==="ho/admission"));
});
