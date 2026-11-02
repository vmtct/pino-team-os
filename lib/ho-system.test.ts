import test from "node:test";
import assert from "node:assert/strict";
import { HO_STAGING_HOSTNAME, decideHostBoundary } from "./host-boundary";
import { handleBoOperationalReadRequest } from "./bo-read-handler";
import { hoAccessReadAllowed, validateHoAuditQuery, projectHoAuditResponse } from "./ho-access-guard";
import { hoRoutes, hoModules, mapHoUsers, mapHoRoles } from "./ho-system";
import type { HoEnv } from "./ho-auth";
import { defaultTable } from "./bo-registration";

const id="0198d050-56c1-7ac5-b9ab-b0e45d912345";
const host=HO_STAGING_HOSTNAME;
const paths=["/api/bo/access/users","/api/bo/access/roles",`/api/bo/access/roles/${id}`,"/api/bo/access/permissions","/api/bo/access/audit"];
test("HO admits registered read-only Staff and system scopes while denying writes and neighboring routes",()=>{
 for(const p of ["/ho/centers","/ho/staff","/ho/system/users","/ho/system/roles","/ho/system/audit",...paths,"/api/bo/workforce/staff-records"]){
  assert.equal(decideHostBoundary(host,p,"GET").action,"next",p);
  assert.equal(decideHostBoundary(host,p,"HEAD").action,p.startsWith("/api/")?"not_found":"next",p);
  for(const method of ["POST","PUT","PATCH","DELETE","OPTIONS"]) assert.equal(decideHostBoundary(host,p,method).action,"not_found",method+p);
 }
 for(const p of ["/api/bo/access/assignments","/api/bo/access/users/status",`/api/bo/access/roles/${id}/archive`,
  `/api/bo/access/roles/${id}/update`,"/api/bo/access/support-sessions",
  "/ho/system/permissions","/ho/system/roles/unknown","/bo/system/users"])
  assert.equal(decideHostBoundary(host,p,"GET").action,"not_found",p);
 for(const h of ["bo.staging.pinohouse.art","tos.staging.pinohouse.art","ho.pinohouse.art","localhost:3000","unknown.example"])
  for(const path of ["/ho/system/users","/ho/system/roles","/ho/system/audit"])assert.equal(decideHostBoundary(h,path).action,"not_found",h+path);
});
test("HO read facade guard is a small explicit allowlist",()=>{
 for(const p of ["centers","access/users","access/roles","access/permissions","access/audit",`access/roles/${id}`])
  assert.equal(hoAccessReadAllowed(p),true,p);
 for(const p of ["access/assignments","access/users/status","access/roles/x","access/audit/subject","access/support-sessions","learners","audit/subject"])
  assert.equal(hoAccessReadAllowed(p),false,p);
});
test("HO audit browse parameters are bounded and reject ambiguous filters",()=>{
 for(const p of ["limit=0","limit=101","offset=-1","outcome=anything","includePayload=true","query="+("a".repeat(121)),"limit=20&limit=30"])
   assert.throws(()=>validateHoAuditQuery(new URLSearchParams(p)),p);
 assert.doesNotThrow(()=>validateHoAuditQuery(new URLSearchParams("limit=25&offset=100&outcome=denied&query=actor")));
});
const auditRecord={id,occurredAt:"2026-10-26T00:00:00Z",requestId:id,actorType:"user",actorId:id,action:"ACCESS_ROLE_UPDATED",subjectType:"access_role",subjectId:id,outcome:"succeeded",payload:{secretToken:"do-not-emit",pii:"email@example.invalid"}};
test("HO server projection strips raw audit JSON, not just hidden in React",()=>{
 const result=projectHoAuditResponse({data:[auditRecord],page:{limit:25,offset:0,total:1,page:1,pageCount:1,hasNext:false,hasPrevious:false}});
 assert.equal(JSON.stringify(result).includes("do-not-emit"),false);
 assert.equal(JSON.stringify(result).includes("payload"),false);
 assert.equal((result as {data: Array<Record<string,unknown>>}).data[0]?.action,"ACCESS_ROLE_UPDATED");
 assert.throws(()=>projectHoAuditResponse({data:{events:[]}}));
});
function env(userId="founder",granted=true):HoEnv{
 return {APP_ENV:"staging",HO_PILOT_FOUNDER_USER_IDS:"founder",PINO_BO_CORE:{
  async executeWithStaffPassword(request,token){
   if(token!=="valid")return {status:401,requestId:"unauth",body:{}};
   if(request.path==="context")return {status:200,requestId:"context",body:{data:{userId,email:"principal@example.invalid",surface:"BO",entitled:true}}};
   if(!granted)return {status:403,requestId:"denied",body:{error:{code:"ACCESS_PERMISSION_DENIED"}}};
   if(request.path==="access/audit")return {status:200,requestId:"audit",body:{data:[auditRecord],page:{limit:25,offset:0,total:1,page:1,pageCount:1,hasNext:false,hasPrevious:false}}};
   return {status:200,requestId:"read",body:{data:[]}};
  }
 }};
}
const req=(p:string,token="valid")=>new Request("https://"+host+"/api/bo/"+p,{headers:{host,cookie:"pino_staff_password_session="+token}});
test("HO requires actual Founder session AND Core's individual read grant, including audit and role detail",async()=>{
 for(const p of ["access/users","access/roles",`access/roles/${id}`,"access/permissions","access/audit?limit=25&offset=0"]){
  const path=p.split("?")[0]!;
  const url=req(p);
  const good=await handleBoOperationalReadRequest(url,env(),path);
  assert.equal(good.status,200,p);
  assert.equal(good.headers.get("cache-control"),"no-store");
  assert.equal((await handleBoOperationalReadRequest(req(p),env("staff"),path)).status,403,p);
  assert.equal((await handleBoOperationalReadRequest(req(p),env("founder",false),path)).status,403,p);
  assert.equal((await handleBoOperationalReadRequest(req(p,"invalid"),env(),path)).status,401,p);
 }
 const audit=await handleBoOperationalReadRequest(req("access/audit?limit=25"),env(),"access/audit");
 assert.doesNotMatch(await audit.text(),/payload|do-not-emit/);
 assert.equal((await handleBoOperationalReadRequest(req("access/audit?includePayload=true"),env(),"access/audit")).status,400);
 assert.equal((await handleBoOperationalReadRequest(req("access/assignments"),env(),"access/assignments")).status,404);
});
test("HO module projections render canonical Users/Roles and route each nav item independently",()=>{
 assert.equal(new Set(Object.values(hoRoutes)).size,Object.keys(hoRoutes).length);
 assert.equal(hoRoutes.users,"/ho/system/users");
 assert.equal(hoRoutes.roles,"/ho/system/roles");
 assert.equal(hoRoutes.audits,"/ho/system/audit");
 assert.equal(hoModules.roles.group,"System");
 const u=mapHoUsers([{id,email:"reader@example.invalid",status:"active",staffMemberId:null,assignments:[]}]);
 assert.equal(u[0]?.name,"reader@example.invalid");
 const r=mapHoRoles([{id,roleKey:"founder",displayName:"Founder",roleType:"system",status:"active",description:null,permissionCount:1,assignmentCount:1}],
 [{id,roleKey:"founder",displayName:"Founder",roleType:"system",status:"active",description:null,permissionCount:1,assignmentCount:1,createdAt:"today",updatedAt:"today",permissionKeys:["access.audit.view"]}]);
 assert.deepEqual(r[0]?.permissionKeys,["access.audit.view"]);
 assert.throws(()=>mapHoRoles([{id,roleKey:"x",displayName:"X",roleType:"custom",status:"active",description:null,permissionCount:0,assignmentCount:0}],[]));
});
test('HO Roles starts compact but retains technical fields for Properties and Detail',()=>{
  const fields=hoModules.roles.fields;
  const table=defaultTable(fields);
  assert.deepEqual(table.visible,['name','roleType','status','permissionCount','assignmentCount']);
  assert.deepEqual(table.order,fields.map(field=>field.key));
  assert.deepEqual(fields.filter(field=>field.defaultVisible===false).map(field=>field.key),['id','roleKey','permissionKeys','description']);
});
