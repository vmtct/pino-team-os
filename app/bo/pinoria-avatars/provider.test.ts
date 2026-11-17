import test from "node:test";
import assert from "node:assert/strict";
import { selfDirectoryProvider } from "./provider";
import { selfQuery } from "./schema";

const center="01900000-0000-7000-8000-000000000001";
const person="01900000-0000-7000-8000-000000000002";
const learner="01900000-0000-7000-8000-000000000003";
const staff="01900000-0000-7000-8000-000000000004";
const signal=()=>new AbortController().signal;
const dual={rowKey:"PERSON:"+person,personId:person,pinoriaSelfId:null,selfStatus:null,
  displayName:"Learner Staff",subjectTypes:["STAFF","LEARNER"],staffMemberId:staff,studentProfileId:learner,
  subjectStatus:"ACTIVE",avatarStatus:"SELF_MISSING",loadoutVersion:null,equippedCount:null,
  ownedCount:null,createdAt:null,createdBy:null,updatedAt:null,updatedBy:null};
const missing={...dual,rowKey:"STAFF:"+staff,personId:null,studentProfileId:null,subjectTypes:["STAFF"],avatarStatus:"IDENTITY_UNLINKED"};
test("PAP-982 Core cursor pages stay bound to selected CENTER and preserve Person/Self truth",async()=>{
  const seen:URL[]=[];
  const fetcher:typeof fetch=async input=>{
    const url=new URL(String(input),"https://bo.staging.pinohouse.art");seen.push(url);
    const result=url.searchParams.has("cursor")?{items:[missing],nextCursor:null}:{items:Array.from({length:8},()=>dual),nextCursor:"cursor_token"};
    if(!url.searchParams.has("cursor")) result.items=Array.from({length:8},(_,i)=>({...dual,rowKey:"PERSON:"+person.slice(0,-1)+i.toString(16)}));
    return Response.json({data:result});
  };
  const provider=selfDirectoryProvider();
  const first=await provider.list({...selfQuery,pageSize:8},{surface:"BO",centerId:center},fetcher,signal());
  assert.equal(first.records.length,8);assert.equal(first.total,9);
  assert.equal(first.records[0].row.pinoriaSelfId,null);assert.equal(first.records[0].row.avatarStatus,"SELF_MISSING");
  assert.equal(first.records[0].row.avatarLabel,"Chưa có Avatar");
  assert.equal(first.records[0].row.subjectLabel,"Đang hoạt động");
  assert.equal(first.records[0].row.loadoutSummary,null);
  const second=await provider.list({...selfQuery,page:2,pageSize:8},{surface:"BO",centerId:center},fetcher,signal());
  assert.equal(second.records.length,1);assert.equal(second.total,9);
  assert.equal(second.records[0].row.personId,null);assert.equal(second.records[0].row.avatarStatus,"IDENTITY_UNLINKED");
  assert.equal(second.records[0].row.avatarLabel,"Chưa liên kết");
  assert.ok(seen.every(u=>u.pathname==="/api/bo/pinoria/avatars" && u.searchParams.get("centerId")===center));
  assert.equal(seen.at(-1)?.searchParams.get("cursor"),"cursor_token");
  assert.equal((await provider.detail("STAFF_"+staff,{surface:"BO",centerId:center},fetcher,signal()))?.row.pinoriaSelfId,null);
  await assert.rejects(provider.list(selfQuery,{surface:"HO"},fetcher,signal()));
});
test("PAP-982 refuses a fabricated canonical identity or unsupported backend filters",async()=>{
  const provider=selfDirectoryProvider();
  const bad:typeof fetch=async()=>Response.json({data:{items:[{...dual,personId:null}],nextCursor:null}});
  await assert.rejects(provider.list(selfQuery,{surface:"BO",centerId:center},bad,signal()));
  await assert.rejects(provider.list({...selfQuery,filters:{logic:"OR",rules:[]}},{surface:"BO",centerId:center},bad,signal()));
});

test("PAP-1456 Self Table localizes labels and shows true Core Loadout count without changing filters",async()=>{
  const ready={...dual,nickname:"Mây",avatarStatus:"READY",pinoriaSelfId:"01900000-0000-7000-8000-000000000005",selfStatus:"ACTIVE",loadoutVersion:4,equippedCount:4,ownedCount:6,
    createdAt:"2026-11-09T19:30:00.000Z",createdBy:null,updatedAt:"2026-11-10T00:15:00.000Z",updatedBy:null};
  const fetcher:typeof fetch=async()=>Response.json({data:{items:[ready],nextCursor:null}});
  const result=await selfDirectoryProvider().list(selfQuery,{surface:"BO",centerId:center},fetcher,signal());
  assert.equal(result.records[0].row.avatarLabel,"Sẵn sàng");
  assert.equal(result.records[0].row.loadoutSummary,"4/8");
  assert.equal(result.records[0].row.ownedCount,6,"ownedCount is not equippedCount");
  assert.equal(result.records[0].row.name,"Learner Staff · Mây");
  assert.equal(result.records[0].row.createdAt,"10/11/2026 · 02:30");
  assert.equal(result.records[0].row.updatedAt,"10/11/2026 · 07:15");
  assert.equal(result.records[0].row.createdBy,null);
  assert.equal(result.records[0].row.updatedBy,null);
  assert.deepEqual(selfQuery.visible,["name","roles","avatarLabel","ownedCount","loadoutSummary"]);
  assert.deepEqual(selfQuery.order.slice(5,9),["createdAt","createdBy","updatedAt","updatedBy"]);
  assert.ok(selfQuery.order.includes("subjectLabel"));
  assert.equal(selfQuery.filters.logic,"AND");
});
test("PAP-1779 [PNR-AVATAR-CRUD] rejects absent, forged or malformed Core audit and count",async()=>{
  const ready={...dual,avatarStatus:"READY",pinoriaSelfId:"01900000-0000-7000-8000-000000000005",
    selfStatus:"ACTIVE",loadoutVersion:1,equippedCount:1,ownedCount:0,
    createdAt:"2026-11-09T17:00:00.000Z",createdBy:null,updatedAt:"2026-11-09T17:00:00.000Z",updatedBy:null};
  const read=async(value:unknown)=>selfDirectoryProvider().list(selfQuery,{surface:"BO",centerId:center},
    async()=>Response.json({data:{items:[value],nextCursor:null}}),signal());
  assert.equal((await read(ready)).records[0].row.ownedCount,0);
  assert.equal((await read(dual)).records[0].row.ownedCount,null);
  for (const bad of [
    {...ready,ownedCount:undefined}, {...ready,ownedCount:-1}, {...ready,ownedCount:"4"},
    {...ready,createdAt:"yesterday"}, {...ready,updatedAt:42},
    {...ready,createdBy:" "}, {...ready,updatedBy:14},
    {...dual,ownedCount:1}, {...dual,createdAt:"2026-11-09T17:00:00.000Z"},
  ]) await assert.rejects(read(bad));
});
