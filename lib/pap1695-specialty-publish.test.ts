/** PAP-1695 / PAP-1491 SPEC-UNLOCK — command and advisory readiness contract. */
import {describe,it} from "node:test";
import assert from "node:assert/strict";
import {parseHoSpecialtyV2Command} from "./ho-specialty-v2-command-facade";
import {postSpecialtyGraphCommand} from "./ho-specialty-v2-graph-client";
import {specialtyPublishWarnings} from "./ho-specialty-v2-publish";
import {BoApiError} from "./bo-api-error";
import type {SpecialtyV2Detail,SpecialtyV2Summary} from "./ho-specialty-v2-reader";

const id=(v:number)=>"01a03c6e-cc58-7d81-ac8e-"+v.toString(16).padStart(12,"0");
const draft:SpecialtyV2Detail={
 id:id(1),pathProgramId:id(2),name:"Chibi Art",description:null,status:"DRAFT",
 tags:[],version:3,missionCountDistinct:1,prerequisiteIds:[],
 levels:[{id:id(3),order:1,name:"Level 1",missionIds:[id(4)]}],
};
const active:SpecialtyV2Detail={...draft,status:"ACTIVE",version:4};
const envelope=(data:unknown,status=200)=>new Response(JSON.stringify({data}),{status,headers:{"content-type":"application/json"}});
const signal=()=>new AbortController().signal;

void describe("PAP-1695 S1P HO DSA inline Publish",()=>{
 void it("admits ONLY exact PUBLISH expectedVersion command without status-bypass fields",()=>{
  assert.deepEqual(parseHoSpecialtyV2Command({type:"PUBLISH",expectedVersion:3}),{type:"PUBLISH",expectedVersion:3});
  for(const raw of [
   {type:"UNPUBLISH",expectedVersion:4},
   {type:"PUBLISH",expectedVersion:0},
   {type:"PUBLISH",expectedVersion:3,status:"ACTIVE"},
   {type:"PUBLISH",expectedVersion:3,permission:"founder"},
   {type:"PUBLISH",expectedVersion:"3"},
   {type:"PUBLISH"},
  ])assert.equal(parseHoSpecialtyV2Command(raw),null);
  assert.deepEqual(parseHoSpecialtyV2Command({type:"LINK_MISSION",expectedVersion:1,levelId:id(3),missionId:id(4)}),
   {type:"LINK_MISSION",expectedVersion:1,levelId:id(3),missionId:id(4)});
 });
 void it("disables invalid Level/Mission prerequisite combinations without inventing server Mission authority",()=>{
  assert.deepEqual(specialtyPublishWarnings(draft,[]),[]);
  assert.match(specialtyPublishWarnings({...draft,missionCountDistinct:0,levels:[{...draft.levels[0]!,missionIds:[]}]},[]).join(" "),/chưa liên kết nhiệm vụ/);
  const wrong:SpecialtyV2Summary={...active,id:id(5),pathProgramId:id(6)};
  assert.match(specialtyPublishWarnings({...draft,prerequisiteIds:[id(5)]},[wrong]).join(" "),/Tiên quyết/);
  const inactive:SpecialtyV2Summary={...draft,id:id(5)};
  assert.match(specialtyPublishWarnings({...draft,prerequisiteIds:[id(5)]},[inactive]).join(" "),/Tiên quyết/);
  const valid:SpecialtyV2Summary={...active,id:id(5)};
  assert.deepEqual(specialtyPublishWarnings({...draft,prerequisiteIds:[id(5)]},[valid]),[]);
 });
 void it("requires Core POST ACTIVE and independent GET ACTIVE readback, never synthetic success",async()=>{
  const calls:{method:string;path:string}[]=[];
  const f=(async(input:RequestInfo|URL,init?:RequestInit)=>{
   const path=String(input);const method=init?.method??"GET";
   calls.push({method,path});
   if(method==="GET")return envelope(calls.length===1?draft:active);
   assert.equal(path,"/api/ho/learning/specialties/"+draft.id+"/commands");
   assert.equal(init?.headers instanceof Headers,false);
   assert.equal((init?.headers as Record<string,string>)["idempotency-key"],"spec_publish_1234567890");
   assert.deepEqual(JSON.parse(String(init?.body)),{type:"PUBLISH",expectedVersion:3});
   return envelope(active);
  }) as typeof fetch;
  const result=await postSpecialtyGraphCommand(draft.id,{type:"PUBLISH",expectedVersion:3},f,signal(),"spec_publish_1234567890");
  assert.equal(result.status,"ACTIVE");
  assert.deepEqual(calls.map(x=>x.method),["GET","POST","GET"]);
 });
 void it("fails closed on stale CAS, HTTP 409 and malformed Core result",async()=>{
  const stale=(async()=>envelope({...draft,version:4})) as typeof fetch;
  await assert.rejects(()=>postSpecialtyGraphCommand(draft.id,{type:"PUBLISH",expectedVersion:3},stale,signal(),"spec_publish_1234567890"),
   (e:unknown)=>e instanceof BoApiError&&e.status===409);
  let count=0;
  const conflict=(async()=>{count++;return count===1?envelope(draft):Response.json({error:{code:"VERSION_CONFLICT"}},{status:409});}) as typeof fetch;
  await assert.rejects(()=>postSpecialtyGraphCommand(draft.id,{type:"PUBLISH",expectedVersion:3},conflict,signal(),"spec_publish_1234567890"),
   (e:unknown)=>e instanceof BoApiError&&e.status===409);
  let next=0;
  const fake=(async()=>{next++;return envelope(draft);}) as typeof fetch;
  await assert.rejects(()=>postSpecialtyGraphCommand(draft.id,{type:"PUBLISH",expectedVersion:3},fake,signal(),"spec_publish_1234567890"),
   (e:unknown)=>e instanceof BoApiError&&e.status===502);
 });
});
