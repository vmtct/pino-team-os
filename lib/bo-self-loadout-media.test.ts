/** PAP-1356 / PAP-1428 — BO private Self media bytes and negative ACL contract. */
import test from "node:test";
import assert from "node:assert/strict";
import {handleBoSelfLoadoutRequest,isBoSelfLoadoutPath,type BoSelfLoadoutEnv} from "./bo-self-loadout-handler";
import type {BoAccessCoreBinding,BoAccessRequest} from "./bo-core";
const selfId="01a18140-10b8-70d3-ad6b-3e747a0cddea",centerId="01a0b29a-3acd-7a18-a0f2-cf6016548ab5";
const path="pinoria/selfs/"+selfId+"/loadout/media/HAIR";
const base="https://bo.staging.pinohouse.art/api/bo/"+path+"?centerId="+centerId;
const png=Uint8Array.of(137,80,78,71,13,10,26,10,10,9,8,7);
const data={data:{mimeType:"image/png",byteSize:png.length,bytesBase64:Buffer.from(png).toString("base64")}};
const cookie="pino_staff_password_session=pap1356-session";
const req=(pathOverride=base,method="GET",authenticated=true)=>new Request(pathOverride,{method,headers:authenticated?{cookie}:{}});
function fixture(status=200,body:unknown=data){
  const sent:Array<{req:BoAccessRequest;token:string}>=[];
  const binding:BoAccessCoreBinding={executeWithStaffPassword:async(request,token)=>{
    sent.push({req:request,token});return {status,body,requestId:"pap1356-media-check"};
  }};
  return {sent,env:{PINO_BO_CORE:binding} as BoSelfLoadoutEnv};
}
test("PAP-1356 BO media GET returns binary with private, no-store; no public R2 key",async()=>{
  const f=fixture();
  assert.equal(isBoSelfLoadoutPath(path),true);
  const response=await handleBoSelfLoadoutRequest(req(),f.env,path);
  assert.equal(response.status,200);
  assert.equal(response.headers.get("content-type"),"image/png");
  assert.match(response.headers.get("cache-control")??"",/private, no-store/);
  assert.equal(response.headers.get("x-content-type-options"),"nosniff");
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()),png);
  assert.deepEqual(f.sent,[{req:{method:"GET",path,resource:{centerId}},token:"pap1356-session"}]);
});
test("PAP-1356 BO media fails closed on invalid scope, unknown slot, unauthorized and wrong verb",async()=>{
  const f=fixture();
  for(const u of [base+"&actor=founder",base+"&centerId="+centerId,base.replace(centerId,"invalid")]){
    assert.equal((await handleBoSelfLoadoutRequest(req(u),f.env,path)).status,400);
  }
  assert.equal((await handleBoSelfLoadoutRequest(req(base,"GET",false),f.env,path)).status,401);
  assert.equal((await handleBoSelfLoadoutRequest(req(base,"POST"),f.env,path)).status,405);
  const wrong=path.replace("HAIR","R2_KEY");
  assert.equal((await handleBoSelfLoadoutRequest(req(base.replace("HAIR","R2_KEY")),f.env,wrong)).status,404);
  assert.equal(f.sent.length,0);
  assert.equal((await handleBoSelfLoadoutRequest(req(),fixture(403,{error:{code:"ACCESS_PERMISSION_DENIED"}}).env,path)).status,403);
  assert.equal((await handleBoSelfLoadoutRequest(req(),fixture(404,{error:{code:"NOT_FOUND"}}).env,path)).status,404);
});
test("PAP-1356 BO media rejects inconsistent upstream base64, byte length, MIME and image signature",async()=>{
  const cases=[
    {data:{...data.data,mimeType:"text/html"}},
    {data:{...data.data,byteSize:999}},
    {data:{...data.data,bytesBase64:"%%%"}},
    {data:{...data.data,bytesBase64:Buffer.from("not png").toString("base64"),byteSize:7}},
    {data:{...data.data,byteSize:11*1024*1024}},
  ];
  for(const body of cases){
    const r=await handleBoSelfLoadoutRequest(req(),fixture(200,body).env,path);
    assert.equal(r.status,502);
    assert.equal((await r.json() as {error:{code:string}}).error.code,"PLATFORM_UPSTREAM_INVALID_MEDIA");
  }
});
