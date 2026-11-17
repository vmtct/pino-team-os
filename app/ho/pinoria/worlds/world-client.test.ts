import test from "node:test";
import assert from "node:assert/strict";
import {createWorldAndReadback,mapWorldDrawerRow,loadWorlds} from "./world-client";
const payload={key:"qa-world",displayName:"QA World",worldType:"CORE" as const,descriptionText:""};
const id="019a0000-0000-7000-8000-000000000001";
const row={...payload,id,status:"DRAFT",scenes:[],createdAt:"2026-11-17T01:00:00.000Z",updatedAt:"2026-11-17T01:00:00.000Z",createdByUser:null,updatedByUser:null};
function mock(read:unknown={worlds:[row]},write:unknown=row,status=201){
 const calls:RequestInit[]=[];
 const fetcher:typeof fetch=async(url,init)=>{assert.equal(url,"/api/ho/pinoria/worlds");calls.push(init??{});return Response.json({data:init?.method==="POST"?write:read},{status:init?.method==="POST"?status:200})};
 return {fetcher,calls};
}
test("POST once, same id and audit readback then success; no optimistic creation",async()=>{const {fetcher,calls}=mock();const r=await createWorldAndReadback(payload,fetcher,"known-qa-idempotency");assert.equal(r.id,id);assert.equal(r.createdByUser,"—");assert.deepEqual(calls.map(x=>x.method),["POST","GET"]);assert.equal(new Headers(calls[0]?.headers).get("idempotency-key"),"known-qa-idempotency");assert.equal(calls[0]?.body,JSON.stringify(payload));});
test("failed or ambiguous create is never repeated and no false readback",async()=>{for(const [read,write,status,callCount] of [[{worlds:[]},row,201,2],[{worlds:[{...row,status:"ACTIVE"}]},row,201,2],[{worlds:[{...row,createdAt:null}]},row,201,2],[{worlds:[row]},row,409,1],[{worlds:[row]},{...row,id:"bad"},201,1]] as const){const {fetcher,calls}=mock(read,write,status);await assert.rejects(()=>createWorldAndReadback(payload,fetcher,"known-qa-idempotency"));assert.equal(calls.length,callCount);}});
test("audit unknown is —, timestamp real, counts derived deterministically",()=>{const m=mapWorldDrawerRow({...row,scenes:[{layers:[{},{}]}],createdByUser:"QA Verified"});assert.equal(m.sceneCount,1);assert.equal(m.layerCount,2);assert.equal(m.createdAt,row.createdAt);assert.equal(m.createdByUser,"QA Verified");assert.equal(m.updatedByUser,"—");});
test("duplicate canonical IDs fail closed",async()=>{const {fetcher}=mock({worlds:[row,row]});await assert.rejects(()=>loadWorlds(fetcher));});
