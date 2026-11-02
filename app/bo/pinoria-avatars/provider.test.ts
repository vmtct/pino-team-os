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
  subjectStatus:"ACTIVE",avatarStatus:"SELF_MISSING",loadoutVersion:null,equippedCount:null};
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
  const second=await provider.list({...selfQuery,page:2,pageSize:8},{surface:"BO",centerId:center},fetcher,signal());
  assert.equal(second.records.length,1);assert.equal(second.total,9);
  assert.equal(second.records[0].row.personId,null);assert.equal(second.records[0].row.avatarStatus,"IDENTITY_UNLINKED");
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
