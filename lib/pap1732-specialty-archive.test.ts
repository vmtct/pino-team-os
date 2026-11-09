/** PAP-1732 / PAP-1491 SPEC-UNLOCK S1L-A — strict HO Archive/Restore facade and command tests. */
import {describe,it} from "node:test";
import assert from "node:assert/strict";
import {parseHoSpecialtyV2Command} from "./ho-specialty-v2-command-facade";
import {postSpecialtyGraphCommand} from "./ho-specialty-v2-graph-client";
import {BoApiError} from "./bo-api-error";
import {specialtyStatusLabel} from "../app/ho/learning/specialties/schema";
import type {SpecialtyV2Detail} from "./ho-specialty-v2-reader";
const id=(n:number)=>"01a03c6e-cc58-7d81-ac8e-"+n.toString(16).padStart(12,"0");
const draft:SpecialtyV2Detail={id:id(1),pathProgramId:id(2),name:"Archive Fixture",description:null,status:"DRAFT",
 tags:[],version:1,missionCountDistinct:0,prerequisiteIds:[],levels:[]};
const archived:SpecialtyV2Detail={...draft,status:"ARCHIVED",version:2};
const restored:SpecialtyV2Detail={...draft,version:3};
const envelope=(data:unknown,status=200)=>new Response(JSON.stringify({data}),{status,headers:{"content-type":"application/json"}});
const signal=()=>new AbortController().signal;
void describe("PAP-1732 S1L-A HO Archive/Restore",()=>{
 void it("strictly validates new commands; no grant-count, ACL or force override fields",()=>{
  assert.deepEqual(parseHoSpecialtyV2Command({type:"ARCHIVE",expectedVersion:1}),{type:"ARCHIVE",expectedVersion:1});
  assert.deepEqual(parseHoSpecialtyV2Command({type:"RESTORE",expectedVersion:2}),{type:"RESTORE",expectedVersion:2});
  for(const bad of [
   {type:"ARCHIVE",expectedVersion:1,force:true},
   {type:"ARCHIVE",expectedVersion:1,grantCount:0},
   {type:"RESTORE",expectedVersion:2,autoActivate:true},
   {type:"RESTORE",expectedVersion:"2"},
   {type:"ARCHIVE",expectedVersion:0},
   {type:"DELETE",expectedVersion:2},
  ])assert.equal(parseHoSpecialtyV2Command(bad),null,JSON.stringify(bad));
  assert.equal(specialtyStatusLabel("ARCHIVED"),"Đã lưu trữ");
 });
 void it("DRAFT→ARCHIVED: GET before, one POST, independent GET after",async()=>{
  const calls:{method:string;payload:unknown}[]=[];
  const fetcher=(async(_input:RequestInfo|URL,init?:RequestInit)=>{
   const method=init?.method??"GET";
   calls.push({method,payload:init?.body?JSON.parse(String(init.body)):null});
   if(method==="GET")return envelope(calls.length===1?draft:archived);
   assert.equal((init?.headers as Record<string,string>)["idempotency-key"],"spec_archive_test_1234");
   return envelope(archived);
  }) as typeof fetch;
  const result=await postSpecialtyGraphCommand(draft.id,{type:"ARCHIVE",expectedVersion:1},
   fetcher,signal(),"spec_archive_test_1234");
  assert.equal(result.status,"ARCHIVED");assert.equal(result.version,2);
  assert.deepEqual(calls.map(c=>c.method),["GET","POST","GET"]);
  assert.deepEqual(calls[1]?.payload,{type:"ARCHIVE",expectedVersion:1});
 });
 void it("ARCHIVED→DRAFT: no direct ACTIVE and version readback checked",async()=>{
  const calls:{method:string;payload:unknown}[]=[];
  const fetcher=(async(_input:RequestInfo|URL,init?:RequestInit)=>{
   const method=init?.method??"GET";
   calls.push({method,payload:init?.body?JSON.parse(String(init.body)):null});
   return envelope(method==="GET"?(calls.length===1?archived:restored):restored);
  }) as typeof fetch;
  const result=await postSpecialtyGraphCommand(draft.id,{type:"RESTORE",expectedVersion:2},
    fetcher,signal(),"spec_restore_test_1234");
  assert.equal(result.status,"DRAFT");assert.equal(result.version,3);
  assert.deepEqual(calls.map(c=>c.method),["GET","POST","GET"]);
  assert.deepEqual(calls[1]?.payload,{type:"RESTORE",expectedVersion:2});
 });
 void it("fail closed: wrong state, Core 409 and false ARCHIVED success",async()=>{
  const wrongState=(async()=>envelope(draft)) as typeof fetch;
  await assert.rejects(()=>postSpecialtyGraphCommand(draft.id,{type:"RESTORE",expectedVersion:1},
    wrongState,signal(),"spec_restore_test_1234"),(e:unknown)=>e instanceof BoApiError&&e.status===409);
  let count=0;
  const conflict=(async()=>++count===1?envelope(draft):Response.json({error:{code:"SPECIALTY_V2_ARCHIVE_GRANT_PROOF_UNAVAILABLE"}},{status:409})) as typeof fetch;
  await assert.rejects(()=>postSpecialtyGraphCommand(draft.id,{type:"ARCHIVE",expectedVersion:1},
    conflict,signal(),"spec_archive_test_1234"),(e:unknown)=>e instanceof BoApiError&&e.status===409);
  count=0;
  const invalid=(async()=>envelope(++count===1?draft:draft)) as typeof fetch;
  await assert.rejects(()=>postSpecialtyGraphCommand(draft.id,{type:"ARCHIVE",expectedVersion:1},
    invalid,signal(),"spec_archive_test_1234"),(e:unknown)=>e instanceof BoApiError&&e.status===502);
 });
});
