import test from "node:test";
import assert from "node:assert/strict";
import { handleBoSchoolEnrollments } from "./bo-school-enrollments";
import { BO_SKELETON_HOST } from "./bo-skeleton";
import type { BoAccessRequest } from "./bo-core";
const id=(n:number)=>"00000000-0000-4000-8000-"+String(n).padStart(12,"0");
function fixture(denyPath?:string,status=403){
 const calls:BoAccessRequest[]=[];
 const env={APP_ENV:"staging",BO_UI_ONLY:"enabled",PINO_BO_CORE:{async executeWithStaffPassword(r:BoAccessRequest){calls.push(r);if(r.path===denyPath)return {status,requestId:"denied",body:{error:{code:"DENIED"}}};
  const body=r.path==="subscriptions"?{items:[{id:id(1),studentProfileId:id(2),studentDisplayName:"Fixture Student",pathDisplayName:"Art"}],limit:100,nextCursor:{createdAt:"2026-10-25T00:00:00Z",id:id(1)}}:
  {student:{id:id(2)},guardians:[{secret:"DO_NOT_EXPOSE"}],subscriptions:[{subscription:{id:id(1)},enrollments:[{id:id(3),subscriptionId:id(1),runningClassId:id(4),runningClassName:"Fixture Class",effectiveFromLocalDate:"2026-10-25",effectiveUntilExclusiveLocalDate:null,plannedEntryLocalTime:null,plannedDurationMinutes:null,internalSecret:"DO_NOT_EXPOSE"}]},{subscription:{id:id(99)},enrollments:[{id:id(98),subscriptionId:id(99)}]}]};
  return {status:200,requestId:"fixture",body:{data:body}};
 }}};return {env,calls};
}
const request=(query="",cookie=true)=>new Request(`https://${BO_SKELETON_HOST}/api/bo/school/enrollments${query}`,{headers:cookie?{cookie:"pino_staff_password_session=fixture"}:{}});
test("enrollment projection binds subscription/class IDs, preserves cursor and redacts lifecycle private data",async()=>{
 const {env,calls}=fixture();const r=await handleBoSchoolEnrollments(request(),env);assert.equal(r.status,200);const body=await r.json();
 assert.equal(body.data.items.length,1);assert.equal(body.data.items[0].subscriptionId,id(1));assert.equal(body.data.items[0].runningClassId,id(4));assert.equal(body.data.nextCursor.id,id(1));assert.doesNotMatch(JSON.stringify(body),/DO_NOT_EXPOSE|guardians|internalSecret/);
 assert.deepEqual(calls.map(r=>[r.method,r.path]),[["GET","subscriptions"],["GET",`students/${id(2)}/lifecycle`]]);
 assert.equal(r.headers.get("cache-control"),"private, no-store");
});
test("enrollment directory enforces existing auth and propagates subscription/lifecycle denials without partial rows",async()=>{
 const unauth=fixture();assert.equal((await handleBoSchoolEnrollments(request("",false),unauth.env)).status,401);assert.equal(unauth.calls.length,0);
 for(const [path,status] of [["subscriptions",403],[`students/${id(2)}/lifecycle`,409]] as const){const f=fixture(path,status);const r=await handleBoSchoolEnrollments(request(),f.env);assert.equal(r.status,status);assert.equal((await r.json()).data,undefined);}
});
test("enrollment projection rejects unknown/duplicate queries and never activates on production",async()=>{
 for(const query of ["?limit=101","?limit=1&limit=2","?userId=forged","?permission=admin"]){const f=fixture();assert.equal((await handleBoSchoolEnrollments(request(query),f.env)).status,400);assert.equal(f.calls.length,0);}
 const f=fixture();assert.equal((await handleBoSchoolEnrollments(new Request("https://bo.pinohouse.art/api/bo/school/enrollments"),f.env)).status,404);assert.equal(f.calls.length,0);
});
