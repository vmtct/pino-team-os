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
