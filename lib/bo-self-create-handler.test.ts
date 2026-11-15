import test from "node:test";
import assert from "node:assert/strict";
import { handleBoSelfCreateRequest, type BoSelfCreateEnv } from "./bo-self-create-handler";
import type {BoAccessCoreBinding,BoAccessRequest} from "./bo-core";
const centerId="01a0b29a-3acd-7a18-a0f2-cf6016548ab5";
const personId="01a194f0-9bd0-7896-89a0-677a620e3ecd";
const ctx="?centerId="+centerId;
const path="pinoria/avatars";
const base="https://bo.staging.pinohouse.art/api/bo/"+path;
const session={cookie:"pino_staff_password_session=synthetic-local-token"};
const fixture=(status=201)=>{
 const seen:Array<{request:BoAccessRequest,token:string}>=[];
 const binding:BoAccessCoreBinding={
  async executeWithStaffPassword(request,token){
   seen.push({request,token});
   return {status,body:status===201?{data:{id:personId,personId}}:{error:{code:"ACCESS_PERMISSION_DENIED"}},requestId:"pap1625-request"};
  }
 };
 return {env:{PINO_BO_CORE:binding} as BoSelfCreateEnv,seen};
};
function req(body:unknown,query=ctx,headers:Record<string,string>=session){
 return new Request(base+query,{method:"POST",headers:{...headers,"content-type":"application/json"},body:JSON.stringify(body)});
}
test("PAP-1625 authenticated Create forwards only canonical PersonId and selected Center",async()=>{
 const f=fixture();
 const r=await handleBoSelfCreateRequest(req({personId}),f.env,path);
 assert.equal(r.status,201);
 assert.equal(r.headers.get("x-request-id"),"pap1625-request");
 assert.equal(r.headers.get("cache-control"),"no-store");
 assert.deepEqual(f.seen,[{request:{method:"POST",path,resource:{centerId},body:{personId}},token:"synthetic-local-token"}]);
});
test("PAP-1625 rejects malformed Center, actor forging and malformed Person before Core",async()=>{
 const f=fixture();
 for(const query of ["", "?centerId=bad",ctx+"&scope=GLOBAL",ctx+"&centerId="+centerId]){
  assert.equal((await handleBoSelfCreateRequest(req({personId},query),f.env,path)).status,400);
 }
 for(const body of [{personId:"bad"},{personId,actorId:"founder"},{personId,centerId},{}]){
  assert.equal((await handleBoSelfCreateRequest(req(body),f.env,path)).status,400);
 }
 assert.equal((await handleBoSelfCreateRequest(req({personId}),f.env,path+"/extra")).status,404);
 const get=new Request(base+ctx,{method:"GET",headers:session});
 assert.equal((await handleBoSelfCreateRequest(get,f.env,path)).status,405);
 assert.equal(f.seen.length,0);
});
test("PAP-1625 unauthenticated fails closed; Core 403 preserved verbatim",async()=>{
 const f=fixture(403);
 const bad=new Request(base+ctx,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({personId})});
 assert.equal((await handleBoSelfCreateRequest(bad,f.env,path)).status,401);
 assert.equal(f.seen.length,0);
 const denied=await handleBoSelfCreateRequest(req({personId}),f.env,path);
 assert.equal(denied.status,403);
 assert.equal((await denied.json() as {error:{code:string}}).error.code,"ACCESS_PERMISSION_DENIED");
});

test("PAP-1661 nickname is forwarded as trimmed Self-owned field",async()=>{
 const f=fixture();
 const r=await handleBoSelfCreateRequest(req({personId,nickname:"  Mây Hồng  "}),f.env,path);
 assert.equal(r.status,201);
 assert.deepEqual(f.seen[0]?.request.body,{personId,nickname:"Mây Hồng"});
});
test("PAP-1661 invalid Nickname fails closed before Core write",async()=>{
 const f=fixture();
 for(const nickname of ["  ","n".repeat(41),"a"+String.fromCharCode(10)+"b",12,null]){
  const r=await handleBoSelfCreateRequest(req({personId,nickname}),f.env,path);
  assert.equal(r.status,400,JSON.stringify(nickname));
 }
 assert.equal(f.seen.length,0);
});

test("PAP-1979 forwards Starter and stable retry key only for canonical optional selection",async()=>{
 const f=fixture(), starter={setItemId:personId,expectedMembershipRevision:2}, headers={...session,"idempotency-key":"starter-create-stable-key"};
 const first=await handleBoSelfCreateRequest(req({personId,starter},ctx,headers),f.env,path);
 assert.equal(first.status,201);
 assert.deepEqual(f.seen[0]?.request,{method:"POST",path,resource:{centerId},body:{personId,starter},idempotencyKey:"starter-create-stable-key"});
 await handleBoSelfCreateRequest(req({personId,starter},ctx,headers),f.env,path);
 assert.deepEqual(f.seen[1],f.seen[0]);
 for(const bad of [{...starter,expectedMembershipRevision:0},{...starter,expectedMembershipRevision:"2"},{...starter,actorId:personId},null]){
  assert.equal((await handleBoSelfCreateRequest(req({personId,starter:bad},ctx,headers),f.env,path)).status,400);
 }
 assert.equal((await handleBoSelfCreateRequest(req({personId,starter}),f.env,path)).status,400);
 assert.equal(f.seen.length,2);
});
test("PAP-1979 catalog facet is authenticated and selected-Center only",async()=>{
 const f=fixture(200), catalog=path+"/starter-sets", url=base+"/starter-sets"+ctx;
 assert.equal((await handleBoSelfCreateRequest(new Request(url,{headers:session}),f.env,catalog)).status,200);
 assert.deepEqual(f.seen[0]?.request,{method:"GET",path:catalog,resource:{centerId}});
 assert.equal((await handleBoSelfCreateRequest(new Request(url),f.env,catalog)).status,401);
 assert.equal((await handleBoSelfCreateRequest(req({personId}),f.env,catalog)).status,405);
 assert.equal(f.seen.length,1);
});
