import test from "node:test";
import assert from "node:assert/strict";
import {decideHostBoundary} from "./host-boundary";
import {isOperationalReadPath} from "./bo-read-handler";
import {surfaceSession} from "./workspace-adapters/session";
import {handleHoDiaryRead,type DiaryHoEnv} from "@/app/api/ho/learning/path-diaries/[[...path]]/route";

const diaryId="01a19a44-faac-7e68-88f8-23e65f491949";
const boPath="/api/bo/learning/path-diaries/"+diaryId+"/mission-links";
const hoPath="/api/ho/learning/path-diaries/"+diaryId+"/mission-links";

test("PAP-1342 one exact HO+BO Staging source Mission Link GET; deny writes, production, foreign host and other child paths",()=>{
 assert.deepEqual(decideHostBoundary("ho.staging.pinohouse.art",hoPath,"GET"),{action:"next"});
 assert.deepEqual(decideHostBoundary("bo.staging.pinohouse.art",boPath,"GET"),{action:"next"});
 assert.equal(isOperationalReadPath("learning/path-diaries/"+diaryId+"/mission-links"),true);
 for(const method of ["HEAD","OPTIONS","POST","PUT","PATCH","DELETE"]){
  assert.deepEqual(decideHostBoundary("ho.staging.pinohouse.art",hoPath,method),{action:"not_found"},method);
  assert.deepEqual(decideHostBoundary("bo.staging.pinohouse.art",boPath,method),{action:"not_found"},method);
 }
 for(const host of ["bo.pinohouse.art","tos.staging.pinohouse.art","ho.staging.pinohouse.art.evil.test"]){
  assert.deepEqual(decideHostBoundary(host,hoPath,"GET"),{action:"not_found"},host);
  assert.deepEqual(decideHostBoundary(host,boPath,"GET"),{action:"not_found"},host);
 }
 for(const bad of ["/mission-links/extra","/evidence","/missions","/mission-links%2Fextra"]){
  assert.deepEqual(decideHostBoundary("bo.staging.pinohouse.art","/api/bo/learning/path-diaries/"+diaryId+bad,"GET"),{action:"not_found"},bad);
 }
});

test("PAP-1342 HO TDD session admits only authenticated same-origin GET links",async()=>{
 const fetched:string[]=[];
 const s=surfaceSession("HO","https://ho.staging.pinohouse.art",async input=>{
  fetched.push(String(input));return Response.json({data:[{id:"link",missionId:"mission"}]});
 });
 try{
  const res=await s.transport(hoPath,{method:"GET"});
  assert.equal(res.status,200);
  assert.equal(fetched.length,1);
  for(const method of ["POST","PUT","DELETE"]) await assert.rejects(s.transport(hoPath,{method}),/Không thể truy cập/);
  await assert.rejects(s.transport(hoPath+"/extra",{method:"GET"}),/Không thể truy cập/);
  await assert.rejects(s.transport("https://bo.staging.pinohouse.art"+hoPath,{method:"GET"}),/Không thể truy cập/);
  assert.equal(fetched.length,1);
 }finally{s.dispose()}
});

test("PAP-1342 HO Diary BFF rejects invalid Mission child query and writes before credential lookup",async()=>{
 const env={APP_ENV:"production"} as DiaryHoEnv;
 const p="https://ho.staging.pinohouse.art"+hoPath;
 for(const [segments,uri,method,status] of [
  [[diaryId,"mission-links","extra"],p,"GET",404],
  [[diaryId,"missions"],p,"GET",404],
  [[diaryId,"mission-links"],p+"?centerId=bogus","GET",400],
  [[diaryId,"mission-links"],p,"POST",404],
 ] as const){
  const result=await handleHoDiaryRead(new Request(uri,{method}),env,segments);
  assert.equal(result.status,status,method+" "+uri);
 }
});
