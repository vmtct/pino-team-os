import test from "node:test";
import assert from "node:assert/strict";
import {foldSpecialtyName,planSpecialtyMetadataEdit} from "./ho-specialty-s5-metadata";
import {parseSpecialtyMetadataPut,handleHoSpecialtyV2MetadataPut} from "./ho-specialty-v2-metadata-facade";
import {putSpecialtyMetadataEdit} from "./ho-specialty-v2-metadata-client";
import type {SpecialtyV2Detail,SpecialtyV2Summary} from "./ho-specialty-v2-reader";
const id="01a1b541-4343-7872-bfad-022572a7d89b",other="01a1b544-d2b8-7397-a4e2-9cd2830d78a4";
const path="01a03c6e-cc58-7d81-ac8e-aa15cdc52a9c";
const detail:SpecialtyV2Detail={id,pathProgramId:path,name:"Vẽ Chibi",description:"Hiện tại",status:"DRAFT",
 tags:[],version:1,missionCountDistinct:0,prerequisiteIds:[],levels:[]};
test("PAP-1495 S5 metadata: edit 5-field Overview Name and Description safely",()=>{
 const list:SpecialtyV2Summary[]=[detail,{...detail,id:other,name:"Chân dung"}];
 assert.equal(foldSpecialtyName("  VẼ   chibi  "),foldSpecialtyName("ve chibi"));
 assert.deepEqual(planSpecialtyMetadataEdit(detail,list,"name","  Chibi Nâng Cao  "),
  {expectedVersion:1,name:"Chibi Nâng Cao"});
 assert.deepEqual(planSpecialtyMetadataEdit(detail,list,"description"," "),
  {expectedVersion:1,description:null});
 assert.throws(()=>planSpecialtyMetadataEdit(detail,list,"name"," CHAN DUNG "),{status:409});
 assert.throws(()=>planSpecialtyMetadataEdit(detail,list,"name","ab"),{status:400});
 assert.throws(()=>planSpecialtyMetadataEdit(detail,list,"name","a".repeat(161)),{status:400});
 assert.throws(()=>planSpecialtyMetadataEdit(detail,list,"description","x".repeat(4001)),{status:400});
 assert.throws(()=>planSpecialtyMetadataEdit({...detail,status:"ACTIVE"},list,"name","New name"),{status:409});
});
test("PAP-1495 S5 metadata BFF parses only versioned narrow PUT payloads",()=>{
 assert.deepEqual(parseSpecialtyMetadataPut({expectedVersion:1,name:"  Chibi  "}),{expectedVersion:1,name:"Chibi"});
 assert.deepEqual(parseSpecialtyMetadataPut({expectedVersion:1,description:null}),{expectedVersion:1,description:null});
 for(const item of [{expectedVersion:0,name:"Chibi"},{expectedVersion:1,name:"a"},
  {expectedVersion:1,name:"x".repeat(161)},{expectedVersion:1,description:"x".repeat(4001)},
  {expectedVersion:1,name:"Chibi",description:"a"},{expectedVersion:1,status:"ACTIVE"},
  {expectedVersion:1,levelCount:2},{expectedVersion:1,name:"Chibi",pathProgramId:path}])
  assert.equal(parseSpecialtyMetadataPut(item),null,JSON.stringify(item));
});
test("PAP-1495 S5 metadata BFF rejects foreign host/origin/body/key and Production before auth",async()=>{
 const url="https://ho.staging.pinohouse.art/api/ho/learning/specialties/"+id;
 const env={APP_ENV:"staging"} as Parameters<typeof handleHoSpecialtyV2MetadataPut>[1];
 const headers={"host":"ho.staging.pinohouse.art","origin":"https://ho.staging.pinohouse.art",
  "content-type":"application/json","idempotency-key":"spec_s5_name_test_1234"};
 const req=(u:string,h:Record<string,string>,body:unknown)=>new Request(u,
  {method:"PUT",headers:h,body:JSON.stringify(body)});
 const good={expectedVersion:1,name:"Chibi"};
 assert.equal((await handleHoSpecialtyV2MetadataPut(req(url,headers,good),{...env,APP_ENV:"production"} as typeof env,id)).status,404);
 assert.equal((await handleHoSpecialtyV2MetadataPut(req(url+"?next=/",headers,good),env,id)).status,404);
 assert.equal((await handleHoSpecialtyV2MetadataPut(req(url,{...headers,origin:"https://evil.test"},good),env,id)).status,403);
 assert.equal((await handleHoSpecialtyV2MetadataPut(req(url,{...headers,"idempotency-key":""},good),env,id)).status,400);
 assert.equal((await handleHoSpecialtyV2MetadataPut(req(url,headers,{...good,status:"ACTIVE"}),env,id)).status,400);
});
test("PAP-1495 S5 metadata ingress is exact HO staging detail PUT only",async()=>{
 const {decideHostBoundary}=await import("./host-boundary");
 const route="/api/ho/learning/specialties/"+id;
 assert.equal(decideHostBoundary("ho.staging.pinohouse.art",route,"PUT").action,"next");
 for(const [host,pathname,verb] of [
  ["bo.staging.pinohouse.art",route,"PUT"],
  ["ho.pinohouse.art",route,"PUT"],
  ["ho.staging.pinohouse.art",route+"/commands","PUT"],
  ["ho.staging.pinohouse.art",route+"/publish","PUT"],
  ["ho.staging.pinohouse.art",route,"DELETE"],
  ["ho.staging.pinohouse.art","/api/ho/learning/specialties","PUT"],
 ])assert.equal(decideHostBoundary(host,pathname,verb).action,"not_found",host+" "+verb);
});

test("PAP-1495 S5 metadata client does GET→PUT→GET and requires actual readback",async()=>{
 const calls:string[]=[];
 let version=1;
 const fetcher:typeof fetch=async(_u,init)=>{
  const method=init?.method??"GET";calls.push(method);
  if(method==="PUT"){version=2;return Response.json({data:{...detail,name:"Chibi mới",version}});}
  return Response.json({data:{...detail,name:version===1?detail.name:"Chibi mới",version}});
 };
 const result=await putSpecialtyMetadataEdit(id,{expectedVersion:1,name:"Chibi mới"},fetcher,new AbortController().signal,"spec_s5_name_test_1234");
 assert.equal(result.name,"Chibi mới");assert.deepEqual(calls,["GET","PUT","GET"]);
 const stale:typeof fetch=async()=>Response.json({data:{...detail,version:2}});
 await assert.rejects(putSpecialtyMetadataEdit(id,{expectedVersion:1,name:"Chibi mới"},stale,new AbortController().signal,"spec_s5_name_test_1234"),{status:409});
});
