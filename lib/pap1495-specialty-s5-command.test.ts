import test from "node:test";
import assert from "node:assert/strict";
import {parseHoSpecialtyV2Command,handleHoSpecialtyV2Command} from "./ho-specialty-v2-command-facade";
import {postSpecialtyGraphCommand,type SpecialtyGraphCommand} from "./ho-specialty-v2-graph-client";
const id="01a1b541-4343-7872-bfad-022572a7d89b";
const path="01a03c6e-cc58-7d81-ac8e-aa15cdc52a9c";
const mid="01a1b544-d2b8-7397-a4e2-9cd2830d78a4";
const level="01a1b548-cb12-7e38-b5f0-4ec12e99c3ba";
const fixture=(version=1)=>({id,pathProgramId:path,name:"Anime",description:"Test",status:"DRAFT" as const,
 tags:version===1?[]:["Anime"],version,missionCountDistinct:0,prerequisiteIds:[],
 levels:version===1?[]:[{id:level,order:1,name:"Level 1",missionIds:[]}]});
const cmd:SpecialtyGraphCommand={type:"SET_OVERVIEW",expectedVersion:1,levelCount:1,prerequisiteIds:[],tags:["Anime"]};
const url="https://ho.staging.pinohouse.art/api/ho/learning/specialties/"+id+"/commands";
const env={APP_ENV:"staging"} as Parameters<typeof handleHoSpecialtyV2Command>[1];
test("PAP-1495 PAP-1491 S5: strict graph command schema with canonical mission refs",()=>{
 assert.deepEqual(parseHoSpecialtyV2Command(cmd),cmd);
 assert.deepEqual(parseHoSpecialtyV2Command({type:"LINK_MISSION",expectedVersion:3,levelId:level,missionId:mid}),
  {type:"LINK_MISSION",expectedVersion:3,levelId:level,missionId:mid});
 for(const payload of [
  {...cmd,status:"ACTIVE"}, {...cmd,levelCount:21}, {...cmd,levelCount:-1},
  {...cmd,expectedVersion:0}, {...cmd,tags:["Art","art"]},
  {...cmd,prerequisiteIds:[id,id]}, {...cmd,prerequisiteIds:["not-uuid"]},
  {...cmd,tags:[""]}, {...cmd,tags:[" space "]},
  {type:"LINK_MISSION",expectedVersion:1,levelId:"wrong",missionId:mid},
  {type:"DELETE",expectedVersion:1,levelId:level,missionId:mid}
 ])assert.equal(parseHoSpecialtyV2Command(payload),null,JSON.stringify(payload));
});
test("PAP-1495 S5: malformed/foreign requests fail before reading credentials",async()=>{
 const headers={"host":"ho.staging.pinohouse.art","origin":"https://ho.staging.pinohouse.art","content-type":"application/json","idempotency-key":"spec_s5_command_abcd"};
 const r=(target:string,body:unknown,h:Record<string,string>=headers)=>new Request(target,{method:"POST",headers:h,body:JSON.stringify(body)});
 const missingKey=await handleHoSpecialtyV2Command(r(url,cmd,{...headers,"idempotency-key":""}),env,id);
 assert.equal(missingKey.status,400);
 const foreign=await handleHoSpecialtyV2Command(r(url,cmd,{...headers,origin:"https://evil.example"}),env,id);
 assert.equal(foreign.status,403);
 const forged=await handleHoSpecialtyV2Command(r(url,{...cmd,status:"ACTIVE"}),env,id);
 assert.equal(forged.status,400);
 const unknown=await handleHoSpecialtyV2Command(r(url+"?redirect=/",cmd),env,id);
 assert.equal(unknown.status,404);
 const nonStaging=await handleHoSpecialtyV2Command(r(url,cmd),{...env,APP_ENV:"production"} as typeof env,id);
 assert.equal(nonStaging.status,404);
});
test("PAP-1495 S5: client requires real Core precondition, post+readback",async()=>{
 const calls:{url:string;method:string;key?:string}[]=[];
 let version=1;
 const fetcher:typeof fetch=async (input,init)=>{
  const u=String(input),method=init?.method||"GET";
  calls.push({url:u,method,key:new Headers(init?.headers).get("idempotency-key")??undefined});
  if(method==="POST"){version=2;return Response.json({data:fixture(2)});}
  return Response.json({data:fixture(version)});
 };
 const result=await postSpecialtyGraphCommand(id,cmd,fetcher,new AbortController().signal,"spec_s5_command_abcd");
 assert.equal(result.version,2);
 assert.deepEqual(calls.map(c=>c.method),["GET","POST","GET"]);
 assert.equal(calls[1]?.url,"/api/ho/learning/specialties/"+id+"/commands");
 assert.equal(calls[1]?.key,"spec_s5_command_abcd");
});
test("PAP-1495 S5: stale Core version is a conflict and must never POST",async()=>{
 const calls:string[]=[];
 const fetcher:typeof fetch=async (_input,init)=>{
  calls.push(init?.method||"GET");return Response.json({data:fixture(2)});
 };
 await assert.rejects(postSpecialtyGraphCommand(id,cmd,fetcher,new AbortController().signal,"spec_s5_command_abcd"),{status:409});
 assert.deepEqual(calls,["GET"]);
});
test("PAP-1495 S5: Core HTTP 403 and incomplete write receipt must not be reported saved",async()=>{
 const denied:typeof fetch=async (_input,init)=>(init?.method==="POST"?new Response(null,{status:403}):Response.json({data:fixture(1)}));
 await assert.rejects(postSpecialtyGraphCommand(id,cmd,denied,new AbortController().signal,"spec_s5_command_abcd"),{status:403});
 const malformed:typeof fetch=async (_input,init)=>(init?.method==="POST"?Response.json({data:{id,status:"DRAFT"}}):Response.json({data:fixture(1)}));
 await assert.rejects(postSpecialtyGraphCommand(id,cmd,malformed,new AbortController().signal,"spec_s5_command_abcd"),{status:502});
});

test("PAP-1495 S5: greenfield command admits only exact Staging HO route POST at host fence",async()=>{
 const {decideHostBoundary}=await import("./host-boundary");
 const route="/api/ho/learning/specialties/"+id+"/commands";
 assert.equal(decideHostBoundary("ho.staging.pinohouse.art",route,"POST").action,"next");
 for(const [host,pathname,method] of [
  ["ho.pinohouse.art",route,"POST"],["bo.staging.pinohouse.art",route,"POST"],
  ["ho.staging.pinohouse.art",route,"GET"],["ho.staging.pinohouse.art",route,"DELETE"],
  ["ho.staging.pinohouse.art",route+"/any","POST"],
  ["ho.staging.pinohouse.art",route.replace(id,"legacy"),"POST"],
  ["ho.staging.pinohouse.art","/api/ho/learning/specialties/"+id+"/publish","POST"],
 ])assert.notEqual(decideHostBoundary(host,pathname,method).action,"next",host+" "+pathname+" "+method);
});
