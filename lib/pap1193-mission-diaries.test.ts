import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { assignmentDefinition } from "../app/bo/missions/schema";
import { missionLinkedDiaryContent } from "../app/bo/missions/LinkedDiariesView";
import { parseLinkedMissionDiaryPage, readMissionLinkedDiaries } from "./bo-mission-linked-diaries";
import { handleBoOperationalReadRequest, type BoReadEnv } from "./bo-read-handler";
import type { BoAccessRequest } from "./bo-core";

const center="01900000-0000-7000-8000-000000000001",id="01900000-0000-7000-8000-000000000002";
const diaryId="01900000-0000-7000-8000-000000000003",linkId="01900000-0000-7000-8000-000000000004";
const sample={linkId,diaryId,linkedAt:"2026-11-01T10:00:00.000Z",
 diary:{id:diaryId,centerId:center,studentId:id,teachingContextKey:"2026-11-01",runningClassId:null,
  registeredByUserId:id,registeredAt:"2026-11-01T10:00:00.000Z",status:"REGISTERED"}};
const page=(diaries:unknown[]=[],extra:Record<string,unknown>={})=>({assignmentId:id,diaries,limit:100,offset:0,hasMore:false,...extra});
const signal=()=>new AbortController().signal;
test("PAP-1193 TDD Diary tab uses a source-backed adapter; no custom shell",()=>{
 const tab=assignmentDefinition.detail.businessTabs.find(t=>t.id==="diary");
 assert.equal(tab?.source.adapter,"assignment-linked-diaries");
 const html=renderToStaticMarkup(missionLinkedDiaryContent([{
  linkId,diaryId,linkedAt:"2026-11-01T10:00:00.000Z",registeredAt:"2026-11-01T10:00:00.000Z",
  studentId:id,teachingContextKey:"CTX",runningClassId:null,status:"REGISTERED",registeredByUserId:null,
 }]));
 assert.match(html,/Nhật Ký đã liên kết/);
 assert.match(html,/Diary ID/);
 assert.match(html,/CTX/);
 assert.doesNotMatch(html,/<button|data-tdd-shell|<form/);
 assert.match(renderToStaticMarkup(missionLinkedDiaryContent([])),/Chưa có Nhật Ký nào liên kết trực tiếp/);
});
test("PAP-1193 parses only explicit linked Diary projection with verified Center and identity",()=>{
 assert.equal(parseLinkedMissionDiaryPage(page([sample]),center,id).diaries[0]?.diaryId,diaryId);
 for(const malformed of [page([{...sample,diary:{...sample.diary,centerId:id}}]),
  page([{...sample,diary:{...sample.diary,id:linkId}}]),page([sample,sample]),
  page([sample],{assignmentId:diaryId}),page([sample],{limit:0}),
  page([sample],{offset:10001})])
  assert.throws(()=>parseLinkedMissionDiaryPage(malformed,center,id));
});
test("PAP-1193 fetch fail-closed, no invented Diary rows on errors or unsupported pagination",async()=>{
 const paths:string[]=[];
 const fetcher:typeof fetch=async input=>{paths.push(String(input));return Response.json({data:page([sample])});};
 assert.equal((await readMissionLinkedDiaries(fetcher,center,id,signal())).length,1);
 assert.match(paths[0]!,/diaries\?centerId=/);
 const empty:typeof fetch=async()=>Response.json({data:page()});
 assert.deepEqual(await readMissionLinkedDiaries(empty,center,id,signal()),[]);
 const failed:typeof fetch=async()=>Response.json({error:{code:"DENIED"}},{status:403});
 await assert.rejects(readMissionLinkedDiaries(failed,center,id,signal()),(e:unknown)=>typeof e==="object"&&e!==null&&"status"in e&&e.status===403);
 await assert.rejects(readMissionLinkedDiaries(fetcher,id,"invalid",signal()));
});
test("PAP-1193 BFF forwards only authenticated scoped /diaries reads and denies forged query",async()=>{
 const forwarded:BoAccessRequest[]=[];
 const env:BoReadEnv={APP_ENV:"staging",PINO_BO_CORE:{async executeWithStaffPassword(request){
  forwarded.push(request);return{status:403,body:{error:{code:"ACCESS_PERMISSION_DENIED"}},requestId:"denied"};
 }}};
 const path="learning/mission-assignments/"+id+"/diaries";
 const request=(query:string,auth=true)=>new Request("https://bo.staging.pinohouse.art/api/bo/"+path+query,{
  headers:auth?{cookie:"pino_staff_password_session="+"a".repeat(48)}:{}});
 const ok=await handleBoOperationalReadRequest(request("?centerId="+center+"&limit=100&offset=0"),env,path);
 assert.equal(ok.status,403);assert.equal(forwarded.length,1);
 assert.equal(forwarded[0]?.path,path+"?centerId="+center+"&limit=100&offset=0");
 for(const q of ["","?centerId=bad","?centerId="+center+"&centerId="+center,
  "?centerId="+center+"&studentId="+id,"?centerId="+center+"&limit=101",
  "?centerId="+center+"&offset=-1"]){
  assert.equal((await handleBoOperationalReadRequest(request(q),env,path)).status,400,q);
 }
 assert.equal((await handleBoOperationalReadRequest(request("?centerId="+center,false),env,path)).status,401);
 assert.equal(forwarded.length,1);
});
