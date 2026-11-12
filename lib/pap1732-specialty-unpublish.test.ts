/** PAP-1732 / PAP-1491 SPEC-UNLOCK — S1L-U HO one-confirm Unpublish contract. */
import {describe,it} from "node:test";
import assert from "node:assert/strict";
import {parseHoSpecialtyV2Command} from "./ho-specialty-v2-command-facade";
import {postSpecialtyGraphCommand} from "./ho-specialty-v2-graph-client";
import {BoApiError} from "./bo-api-error";
import type {SpecialtyV2Detail} from "./ho-specialty-v2-reader";

const id=(n:number)=>"01a03c6e-cc58-7d81-ac8e-"+n.toString(16).padStart(12,"0");
const active:SpecialtyV2Detail={
 id:id(1),pathProgramId:id(2),name:"Gouache",description:null,status:"ACTIVE",
 tags:[],version:4,missionCountDistinct:1,prerequisiteIds:[id(9)],
 levels:[{id:id(3),order:1,name:"Level 1",missionIds:[id(4)]}],
};
const draft:SpecialtyV2Detail={...active,status:"DRAFT",version:5};
const response=(data:unknown,status=200)=>new Response(JSON.stringify({data}),{status,headers:{"content-type":"application/json"}});
const signal=()=>new AbortController().signal;
void describe("PAP-1732 S1L-U HO inline zero-prep Unpublish",()=>{
 void it("admits exact UNPUBLISH expectedVersion and rejects extra bypass fields",()=>{
  assert.deepEqual(parseHoSpecialtyV2Command({type:"UNPUBLISH",expectedVersion:4}),
   {type:"UNPUBLISH",expectedVersion:4});
  for(const raw of [
   {type:"UNPUBLISH",expectedVersion:4,revokeGrants:true},
   {type:"UNPUBLISH",expectedVersion:4,grantCount:0},
   {type:"UNPUBLISH",expectedVersion:"4"},
   {type:"UNPUBLISH",expectedVersion:0},
   {type:"UNPUBLISH"},
  ])assert.equal(parseHoSpecialtyV2Command(raw),null);
  assert.deepEqual(parseHoSpecialtyV2Command({type:"PUBLISH",expectedVersion:3}),{type:"PUBLISH",expectedVersion:3});
 });
 void it("sends one UNPUBLISH and verifies ACTIVE v4 => DRAFT v5 from real Core GET, with dependents untouched",async()=>{
  const calls:Array<{method:string;path:string;body?:unknown}>=[];
  const fetcher=(async(input:RequestInfo|URL,init?:RequestInit)=>{
   const method=init?.method??"GET",path=String(input);
   calls.push({method,path,...(init?.body?{body:JSON.parse(String(init.body))}:{})});
   if(method==="GET")return response(calls.length===1?active:draft);
   assert.equal(path,"/api/ho/learning/specialties/"+id(1)+"/commands");
   assert.equal((init?.headers as Record<string,string>)["idempotency-key"],"spec_unpublish_test_1234");
   return response(draft);
  }) as typeof fetch;
  const result=await postSpecialtyGraphCommand(id(1),{type:"UNPUBLISH",expectedVersion:4},fetcher,signal(),"spec_unpublish_test_1234");
  assert.equal(result.status,"DRAFT");assert.equal(result.version,5);
  assert.deepEqual(result.prerequisiteIds,active.prerequisiteIds);
  assert.deepEqual(result.levels,active.levels);
  assert.deepEqual(calls.map(x=>x.method),["GET","POST","GET"]);
  assert.deepEqual(calls[1]?.body,{type:"UNPUBLISH",expectedVersion:4});
 });
 void it("fails closed on stale Core ACTIVE, 409 and fake DRAFT response",async()=>{
  const stale=(async()=>response({...active,version:5})) as typeof fetch;
  await assert.rejects(()=>postSpecialtyGraphCommand(id(1),{type:"UNPUBLISH",expectedVersion:4},stale,signal(),"spec_unpublish_test_1234"),
   (e:unknown)=>e instanceof BoApiError&&e.status===409);
  let n=0;
  const conflict=(async()=>++n===1?response(active):Response.json({error:{code:"PLATFORM_CONFLICT"}},{status:409})) as typeof fetch;
  await assert.rejects(()=>postSpecialtyGraphCommand(id(1),{type:"UNPUBLISH",expectedVersion:4},conflict,signal(),"spec_unpublish_test_1234"),
   (e:unknown)=>e instanceof BoApiError&&e.status===409);
  n=0;
  const falseReceipt=(async()=>response(++n===1?active:active)) as typeof fetch;
  await assert.rejects(()=>postSpecialtyGraphCommand(id(1),{type:"UNPUBLISH",expectedVersion:4},falseReceipt,signal(),"spec_unpublish_test_1234"),
   (e:unknown)=>e instanceof BoApiError&&e.status===502);
 });
});
