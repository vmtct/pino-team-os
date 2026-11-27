import test from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";
import { ReceptionHouseError, tosReceptionHouseApi } from "./tos-reception-house-api";

test("PAP-1239 searches only canonical Center and URI-encoded learner name", async () => {
  const calls: Array<{url:string;init:RequestInit}> = [];
  const spy = mock.method(globalThis, "fetch", async (url: string | URL | Request, init: RequestInit) => {
    calls.push({url:String(url),init});
    return Response.json({data:[{studentProfileId:"student-1",displayName:"Minh Ánh",hasCharacter:false,openVisit:null}]});
  });
  try {
    const found = await tosReceptionHouseApi.search("center-1", " Minh Ánh ");
    assert.equal(found.length, 1);
    assert.equal(found[0]?.openVisit, null);
    assert.equal(found[0]?.hasCharacter, false);
    assert.match(calls[0]!.url, /^\/api\/tos-learning\/pinoria\/learners\/search\?centerId=center-1&query=Minh%20%C3%81nh$/);
    assert.equal(calls[0]!.init.cache, "no-store");
  } finally { spy.mock.restore(); }
});

test("PAP-1239 refuses empty search without calling Core", async () => {
  assert.throws(() => tosReceptionHouseApi.search("center-1", "a"), (error: unknown) =>
    error instanceof ReceptionHouseError && error.code === "INVALID_SEARCH");
});

test("PAP-1239 check-in sends real House command with same replay key, no preset required", async () => {
  const requests: Array<{url:string;init:RequestInit}> = [];
  const spy = mock.method(globalThis, "fetch", async (url: string | URL | Request, init: RequestInit) => {
    requests.push({url:String(url),init});
    return Response.json({data:{visit:{id:"visit-1",studentProfileId:"learner-1",centerId:"center-1",checkedInAt:"2026-10-31T09:00:00Z",version:1},character:null}});
  });
  try {
    const input={centerId:"center-1",studentProfileId:"learner-1",checkedInAt:"2026-10-31T09:00:00Z"};
    const first=await tosReceptionHouseApi.checkIn(input,"stable-retry-key");
    await tosReceptionHouseApi.checkIn(input,"stable-retry-key");
    assert.equal(first.character,null);
    assert.deepEqual(requests.map(x=>x.url),[
      "/api/tos-learning/pinoria/house/check-in",
      "/api/tos-learning/pinoria/house/check-in"]);
    for(const request of requests) {
      assert.equal(request.init.method,"POST");
      assert.equal(new Headers(request.init.headers).get("idempotency-key"),"stable-retry-key");
      assert.deepEqual(JSON.parse(String(request.init.body)),input);
      assert.equal(JSON.parse(String(request.init.body)).presetId,undefined);
    }
  } finally { spy.mock.restore(); }
});

test("PAP-1239 keeps Core ACL and conflict failures visible, never fakes success", async () => {
  const spy = mock.method(globalThis, "fetch", async () => Response.json({
    error:{code:"ACCESS_PERMISSION_DENIED",message:"Không có quyền tại trung tâm."}
  },{status:403}));
  try {
    await assert.rejects(() => tosReceptionHouseApi.search("center-1","Minh"),
      (error:unknown) => error instanceof ReceptionHouseError && error.status===403 && error.code==="ACCESS_PERMISSION_DENIED");
  } finally { spy.mock.restore(); }

  const conflict = mock.method(globalThis, "fetch", async () => Response.json({
    error:{code:"CONFLICT",message:"StudentVisit already open"}
  },{status:409}));
  try {
    await assert.rejects(() => tosReceptionHouseApi.checkIn({
      studentProfileId:"student-1",centerId:"center-1",checkedInAt:"2026-10-31T09:00:00Z"
    },"k"),(error:unknown) => error instanceof ReceptionHouseError && error.status===409);
  } finally { conflict.mock.restore(); }
});

test("PAP-2138 recent read uses exact Center, abort and no-store; preserves auth denial", async () => {
  const calls: Array<{url:string;init:RequestInit}> = [];
  const controller=new AbortController();
  const spy=mock.method(globalThis,"fetch",async (url:string|URL|Request,init:RequestInit)=>{
    calls.push({url:String(url),init});
    if(calls.length===1)return Response.json({data:[{studentProfileId:"student-a",displayName:"Recent",hasCharacter:false,openVisit:null}]});
    return Response.json({error:{code:"DENIED",message:"Denied"}},{status:403});
  });
  try {
    assert.throws(()=>tosReceptionHouseApi.recent(""), (e:unknown)=>e instanceof ReceptionHouseError&&e.status===400);
    assert.equal(calls.length,0);
    assert.equal((await tosReceptionHouseApi.recent("center/a",controller.signal))[0]?.studentProfileId,"student-a");
    assert.equal(calls[0]?.url,"/api/tos-learning/pinoria/learners/recent?centerId=center%2Fa");
    assert.equal(calls[0]?.init.cache,"no-store");
    assert.equal(calls[0]?.init.signal,controller.signal);
    await assert.rejects(tosReceptionHouseApi.recent("center-b"),(e:unknown)=>e instanceof ReceptionHouseError&&e.status===403);
    assert.equal(calls.length,2);
  } finally {spy.mock.restore();}
});
const guardianProof={relationshipId:"0198d050-56c1-7ac5-b9ab-b0e45d912345",parentId:"0198d050-56c1-7ac5-b9ab-b0e45d912346",personId:"0198d050-56c1-7ac5-b9ab-b0e45d912347",relationshipVersion:1,personVersion:1,identityVerified:true as const};
test("PAP-2431 checkout sends exact scope, CAS and stable replay key", async () => {
  const input = {centerId:"center-1",studentProfileId:"student-1",expectedVisitId:"visit-1",expectedVersion:1,checkedOutAt:"2026-11-27T10:00:00Z",reason:"Authorized handover",pickupProof:guardianProof};
  const calls: Array<{url:string;init:RequestInit}> = [];
  const spy = mock.method(globalThis,"fetch",async (url:string|URL|Request,init:RequestInit)=>{
    calls.push({url:String(url),init});
    return Response.json({data:{visit:{id:"visit-1",centerId:input.centerId,studentProfileId:input.studentProfileId,checkedInAt:"2026-11-27T08:00:00Z",checkedOutAt:input.checkedOutAt,version:2},character:null,handover:{relationshipId:guardianProof.relationshipId,identityVerified:true}}});
  });
  try {
    assert.equal((await tosReceptionHouseApi.checkOut(input,"stable-key")).visit.version,2);
    await tosReceptionHouseApi.checkOut(input,"stable-key");
    assert.equal(calls.length,2);
    for(const call of calls){
      assert.equal(call.url,"/api/tos-learning/pinoria/house/verified-check-out");
      assert.equal(call.init.method,"POST");
      assert.equal(new Headers(call.init.headers).get("idempotency-key"),"stable-key");
      assert.deepEqual(JSON.parse(String(call.init.body)),input);
    }
    assert.throws(()=>tosReceptionHouseApi.checkOut({...input,expectedVersion:0},"stable-key"),ReceptionHouseError);
    assert.throws(()=>tosReceptionHouseApi.checkOut({...input,expectedVisitId:""},"stable-key"),ReceptionHouseError);
    assert.throws(()=>tosReceptionHouseApi.checkOut({...input,reason:" "},"stable-key"),ReceptionHouseError);
    assert.equal(calls.length,2);
  } finally {spy.mock.restore();}
});

test("PAP-2431 checkout rejects denied, stale and unverified responses", async () => {
  const input={centerId:"center-1",studentProfileId:"student-1",expectedVisitId:"visit-1",expectedVersion:1,checkedOutAt:"2026-11-27T10:00:00Z",reason:"Authorized handover",pickupProof:guardianProof};
  for (const status of [403,409]){
    const spy=mock.method(globalThis,"fetch",async()=>Response.json({error:{code:"REJECTED",message:"Rejected"}},{status}));
    try {await assert.rejects(tosReceptionHouseApi.checkOut(input,"stable-key"),(e:unknown)=>e instanceof ReceptionHouseError&&e.status===status);}
    finally {spy.mock.restore();}
  }
  const spy=mock.method(globalThis,"fetch",async()=>Response.json({data:{visit:{id:"visit-1",centerId:"wrong-center",studentProfileId:input.studentProfileId,checkedOutAt:input.checkedOutAt,version:2},character:null,handover:{relationshipId:guardianProof.relationshipId,identityVerified:true}}}));
  try {await assert.rejects(tosReceptionHouseApi.checkOut(input,"stable-key"),(e:unknown)=>e instanceof ReceptionHouseError&&e.code==="UNVERIFIED_CHECKOUT");}
  finally {spy.mock.restore();}
});
test("PAP-2431 rejects a receipt for a different visit even with matching student, Center and version",async()=>{
  const input={centerId:"center-1",studentProfileId:"student-1",expectedVisitId:"old-visit",expectedVersion:1,checkedOutAt:"2026-11-27T10:00:00Z",reason:"Authorized handover",pickupProof:guardianProof};
  const spy=mock.method(globalThis,"fetch",async()=>Response.json({data:{visit:{id:"new-visit",centerId:input.centerId,studentProfileId:input.studentProfileId,checkedOutAt:input.checkedOutAt,version:2},character:null,handover:{relationshipId:guardianProof.relationshipId,identityVerified:true}}}));
  try{await assert.rejects(()=>tosReceptionHouseApi.checkOut(input,"stable-key"),(e:unknown)=>e instanceof ReceptionHouseError&&e.code==="UNVERIFIED_CHECKOUT");}
  finally{spy.mock.restore();}
});

test("PAP-2431 rejects legacy checkout receipt without confirmed handover",async()=>{
 const input={centerId:"center-1",studentProfileId:"student-1",expectedVisitId:"visit-1",expectedVersion:1,checkedOutAt:"2026-11-27T10:00:00Z",reason:"Guardian handover",pickupProof:guardianProof};
 const spy=mock.method(globalThis,"fetch",async()=>Response.json({data:{visit:{id:"visit-1",centerId:input.centerId,studentProfileId:input.studentProfileId,checkedOutAt:input.checkedOutAt,version:2},character:null}}));
 try{await assert.rejects(tosReceptionHouseApi.checkOut(input,"key"),(e:unknown)=>e instanceof ReceptionHouseError&&e.code==="UNVERIFIED_CHECKOUT");}finally{spy.mock.restore();}
});
