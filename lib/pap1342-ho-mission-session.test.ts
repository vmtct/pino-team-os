import test from "node:test";
import assert from "node:assert/strict";
import {surfaceSession} from "./workspace-adapters/session";
import {decideHostBoundary} from "./host-boundary";
const uuid="019d9880-1025-7000-8000-000000000031";
const path="/api/ho/learning/missions/"+uuid;
test("PAP-1342 HO TDD only admits exact same-origin read of source Mission detail",async()=>{
 const calls:string[]=[];
 const s=surfaceSession("HO","https://ho.staging.pinohouse.art",async input=>{
  calls.push(String(input));
  return Response.json({data:{id:uuid,code:"QA-TOS-ART-01",name:"[QA TOS] Pha màu cơ bản"}});
 });
 try{
  assert.deepEqual(decideHostBoundary("ho.staging.pinohouse.art",path,"GET"),{action:"next"});
  const result=await s.transport(path,{method:"GET"});
  assert.equal(result.status,200);
  assert.deepEqual(calls,["https://ho.staging.pinohouse.art"+path]);
  for(const method of ["POST","PUT","PATCH","DELETE","HEAD"]){
   await assert.rejects(s.transport(path,{method}),/Không thể truy cập/,method);
  }
  for(const illegal of [
   "/api/ho/learning/missions",
   "/api/ho/learning/missions/"+uuid+"/write",
   "/api/ho/learning/missions/"+uuid+"/history",
   "/api/ho/learning/missions/not-an-id",
   "https://bo.staging.pinohouse.art"+path,
   "https://ho.staging.pinohouse.art.evil.test"+path,
  ]) await assert.rejects(s.transport(illegal,{method:"GET"}),/Không thể truy cập/,illegal);
  assert.equal(calls.length,1,"all other access stays fail-closed");
 }finally{s.dispose()}
});
