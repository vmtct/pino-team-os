import test from "node:test";
import assert from "node:assert/strict";
import {handleBoSelfLoadoutRequest,isBoSelfLoadoutPath,SELF_LOADOUT_SLOTS,type BoSelfLoadoutEnv} from "./bo-self-loadout-handler";
import type {BoAccessCoreBinding,BoAccessRequest} from "./bo-core";
const centerId="01a0b29a-3acd-7a18-a0f2-cf6016548ab5";
const selfId="01a18140-10b8-70d3-ad6b-3e747a0cddea";
const itemId="01a194f0-9bd0-7896-89a0-677a620e3ecd";
const path="pinoria/selfs/"+selfId+"/loadout";
const url="https://bo.staging.pinohouse.art/api/bo/"+path+"?centerId="+centerId;
const cookie={cookie:"pino_staff_password_session=pap1356-local-token"};
function fixture(status=200){
  const seen:Array<{request:BoAccessRequest;token:string}>=[];
  const binding:BoAccessCoreBinding={async executeWithStaffPassword(request,token){
    seen.push({request,token});
    return {status,body:status===200?{data:{selfId,version:0,slots:{},ready:false}}:{error:{code:status===403?"ACCESS_PERMISSION_DENIED":"PLATFORM_CONFLICT"}},requestId:"pap1356-request"};
  }};
  return {env:{PINO_BO_CORE:binding} as BoSelfLoadoutEnv,seen};
}
function request(method="GET",body?:unknown,qs=url,key="pap1356-attempt"){
  return new Request(qs,{method,headers:{...cookie,...(body?{"content-type":"application/json","idempotency-key":key}:{})},...(body?{body:JSON.stringify(body)}:{})});
}
const slots=()=>Object.fromEntries(SELF_LOADOUT_SLOTS.map(k=>[k,null])) as Record<string,string|null>;
test("PAP-1356 only exact canonical Self Loadout path and GET/POST",async()=>{
  const f=fixture();
  assert.equal(isBoSelfLoadoutPath(path),true);
  for(const wrong of ["pinoria/selfs/"+selfId,"pinoria/selfs/"+selfId+"/loadout/history","pinoria/selfs/forged/loadout"]){
    assert.equal((await handleBoSelfLoadoutRequest(request(),f.env,wrong)).status,404);
  }
  assert.equal((await handleBoSelfLoadoutRequest(request("DELETE"),f.env,path)).status,405);
  assert.equal(f.seen.length,0);
});
test("PAP-1356 GET sends only explicit Center through real BO credential",async()=>{
  const f=fixture();
  const response=await handleBoSelfLoadoutRequest(request(),f.env,path);
  assert.equal(response.status,200);assert.equal(response.headers.get("cache-control"),"no-store");
  assert.deepEqual(f.seen,[{request:{method:"GET",path,resource:{centerId}},token:"pap1356-local-token"}]);
});
test("PAP-1356 POST forwards eight slots, CAS, reason and idempotency to Core",async()=>{
  const f=fixture();
  const all=slots();all.HAIR=itemId;
  const result=await handleBoSelfLoadoutRequest(request("POST",{expectedVersion:0,itemIdsBySlot:all,reason:"Tạo trang bị"}),f.env,path);
  assert.equal(result.status,200);
  assert.deepEqual(f.seen[0]?.request,{method:"POST",path,resource:{centerId},body:{expectedVersion:0,itemIdsBySlot:all,reason:"Tạo trang bị"},idempotencyKey:"pap1356-attempt"});
});
test("PAP-1356 validates scope, payload, key before forwarding anything",async()=>{
  const f=fixture();
  const good={expectedVersion:0,itemIdsBySlot:slots(),reason:"QA"};
  const wrongQueries=[url+"&actor=founder",url+"&centerId="+centerId,url.replace(centerId,"forged"),url.split("?")[0]!];
  for(const u of wrongQueries)assert.equal((await handleBoSelfLoadoutRequest(request("GET",undefined,u),f.env,path)).status,400);
  for(const bad of [{...good,expectedVersion:-1},{...good,reason:""},{...good,actor:"founder"},{...good,itemIdsBySlot:{}},{...good,itemIdsBySlot:{...slots(),HAIR:"forged"}}]){
    assert.equal((await handleBoSelfLoadoutRequest(request("POST",bad),f.env,path)).status,400);
  }
  assert.equal((await handleBoSelfLoadoutRequest(request("POST",good,url,"short"),f.env,path)).status,400);
  assert.equal(f.seen.length,0);
});
test("PAP-1356 unauthenticated fails closed; Core 403 and 409 are preserved",async()=>{
  const f=fixture();
  const anon=new Request(url);
  assert.equal((await handleBoSelfLoadoutRequest(anon,f.env,path)).status,401);
  assert.equal(f.seen.length,0);
  assert.equal((await handleBoSelfLoadoutRequest(request(),fixture(403).env,path)).status,403);
  assert.equal((await handleBoSelfLoadoutRequest(request("POST",{expectedVersion:0,itemIdsBySlot:slots(),reason:"QA"}),fixture(409).env,path)).status,409);
});
