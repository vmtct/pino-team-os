import test from "node:test";
import assert from "node:assert/strict";
import {handleHoDiaryRead,type DiaryHoEnv} from "@/app/api/ho/learning/path-diaries/[[...path]]/route";
import {surfaceSession} from "@/lib/workspace-adapters/session";

const host="https://ho.staging.pinohouse.art";
const id="01912345-6789-7abc-8def-0123456789ac";
const env={APP_ENV:"production"} as DiaryHoEnv;
test("PAP-1221 BFF never dispatches an unadmitted verb/path/query to Core",async()=>{
 for(const [method,segments,query,status] of [
  ["POST",[],"",404],["DELETE",[id],"",404],
  ["GET",["random"],"",404],["GET",[id,"evidence"],"",404],
  ["GET",[],"?unexpected=x",400],["GET",[],"?centerId=bad",400],
  ["GET",[],"?limit=101",400],["GET",[],"?localDate=2026-02-30",400],
  ["GET",[],"?offset=1&offset=2",400],
 ] as const){
  const response=await handleHoDiaryRead(new Request(host+"/api/ho/learning/path-diaries"+query,{method}),env,segments);
  assert.equal(response.status,status,method+" "+JSON.stringify(segments)+" "+query);
 }
});
test("PAP-1221 BFF denies outside HO staging before asking for Core credential",async()=>{
 const r=await handleHoDiaryRead(new Request(host+"/api/ho/learning/path-diaries",
  {headers:{host:"ho.staging.pinohouse.art"}}),env,[]);
 assert.equal(r.status,404,"APP_ENV production is forbidden");
});
test("PAP-1221 shared HO TDD session admits only bounded GET GLOBAL Diary endpoint",async()=>{
 const calls:string[]=[];
 const transport:typeof fetch=async input=>{calls.push(String(input));return Response.json({data:[]})};
 const s=surfaceSession("HO",host,transport);
 try{
  const good=await s.transport("/api/ho/learning/path-diaries?localDate=2026-10-31",{method:"GET"});
  assert.equal(good.status,200);
  assert.equal(calls.length,1);
  await assert.rejects(s.transport("/api/ho/learning/path-diaries",{method:"POST"}),/Không thể truy cập/);
  await assert.rejects(s.transport("/api/ho/learning/path-diaries/"+id+"/evidence",{method:"GET"}),/Không thể truy cập/);
  await assert.rejects(s.transport("https://bo.staging.pinohouse.art/api/ho/learning/path-diaries",{method:"GET"}),/Không thể truy cập/);
  assert.equal(calls.length,1,"blocked calls never hit fetch");
 }finally{s.dispose()}
});
