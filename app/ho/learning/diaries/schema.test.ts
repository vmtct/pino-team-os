import test from "node:test";
import assert from "node:assert/strict";
import {decideHostBoundary} from "@/lib/host-boundary";
import {HO_PAGE_PATHS,safeHoReturnTo} from "@/lib/ho-routes";
import {hoDiaryDefinition,hoDiaryFields,hoDiaryQuery,hoDiaryQueryForDay,hoDiaryProvider,projectHoDiary,readGlobalDiaries,readGlobalDiary,validDiaryDay,localDayToday} from "./schema";

const center="01912345-6789-7abc-8def-0123456789ab";
const other="01912345-6789-7abc-8def-0123456789dd";
const id="01912345-6789-7abc-8def-0123456789ac";
const row={id,centerId:center,studentId:"01912345-6789-7abc-8def-0123456789ad",
 registeredByUserId:"01912345-6789-7abc-8def-0123456789ae",teachingContextKey:"class:2026-10-31",
 pathKey:"01912345-6789-7abc-8def-0123456789af",runningClassId:null,registeredAt:"2026-10-31T12:00:00.000Z",
 updatedAt:"2026-10-31T12:05:00.000Z",status:"REGISTERED" as const,notes:"Quan sát đã lưu",
 interest:null,difficulty:null,version:1};
const wrap=(data:unknown,status=200)=>new Response(JSON.stringify({data}),{status,headers:{"content-type":"application/json"}});
function reader(data:unknown,status=200){const calls:string[]=[];const fn:typeof fetch=async input=>{calls.push(String(input));return wrap(data,status)};return {fn,calls}}
test("PAP-1221 HO Diary 8 Table columns, read only, linked Mission remains truthful",()=>{
 assert.equal(hoDiaryDefinition.surface,"HO");
 assert.deepEqual(hoDiaryQuery.visible,["student","mission","center","className","date","submitter","status","diaryCode"]);
 assert.equal(hoDiaryFields.find(f=>f.key==="submitter")?.label,"Người Submit");
 assert.equal(hoDiaryFields.find(f=>f.key==="mission")?.label,"Nhiệm vụ");
 assert.equal(hoDiaryDefinition.drawer.actions.length,0);
 assert.equal(hoDiaryDefinition.detail.history.kind,"unavailable");
 assert.equal(hoDiaryDefinition.detail.overview.sections[0]?.fields[0],"student");
 assert.equal(hoDiaryDefinition.detail.overview.sections[0]?.fields[1],"mission");
 const view=projectHoDiary(row);
 assert.equal(view.submitter,row.registeredByUserId);
 assert.equal(view.student,row.studentId);
 assert.equal(view.center,row.centerId);
 assert.equal(view.mission,"Chưa liên kết nhiệm vụ");
 assert.equal(view.missionCompleted,"Chưa xác nhận");
 assert.equal(projectHoDiary({...row,status:"CLOSED"}).missionCompleted,"Chưa xác nhận");
});
test("PAP-1221 HO exact host + GET + Diary route only",()=>{
 const path="/api/ho/learning/path-diaries";
 const host="ho.staging.pinohouse.art";
 const detail=path+"/"+id;
 for(const p of [path,detail,HO_PAGE_PATHS.classroomDiaries]){
  assert.deepEqual(decideHostBoundary(host,p,"GET"),{action:"next"});
  for(const h of ["bo.staging.pinohouse.art","ho.pinohouse.art","tos.staging.pinohouse.art"]){
   assert.deepEqual(decideHostBoundary(h,p,"GET"),{action:"not_found"});
  }
 }
 for(const verb of ["POST","PUT","PATCH","DELETE","HEAD"]){
  assert.deepEqual(decideHostBoundary(host,path,verb),{action:"not_found"});
  assert.deepEqual(decideHostBoundary(host,detail,verb),{action:"not_found"});
 }
 assert.deepEqual(decideHostBoundary(host,path+"/"+id+"/evidence","GET"),{action:"not_found"});
 assert.equal(safeHoReturnTo(HO_PAGE_PATHS.classroomDiaries+"?record="+id),HO_PAGE_PATHS.classroomDiaries+"?record="+id);
});
test("PAP-1221 HO correct VN day, no hidden partial result",async()=>{
 assert.equal(localDayToday(new Date("2026-10-31T17:30:00.000Z")),"2026-11-01");
 assert.equal(validDiaryDay("2026-02-30"),false);
 assert.equal(validDiaryDay("2026-10-31"),true);
 const {fn,calls}=reader({centerId:null,localDate:"2026-10-31",diaries:[row],hasMore:false,limit:100,offset:0});
 const rows=await readGlobalDiaries(fn,"","2026-10-31",new AbortController().signal);
 assert.equal(rows.length,1);
 assert.equal(rows[0]?.id,id);
 assert.match(calls[0]??"",/^\/api\/ho\/learning\/path-diaries\?localDate=2026-10-31&limit=100&offset=0$/);
 const result=await hoDiaryProvider.list(hoDiaryQueryForDay("2026-10-31"),{surface:"HO"},fn,new AbortController().signal);
 assert.equal(result.records[0]?.row.id,id);
 assert.equal(result.total,1);
 assert.equal(result.records[0]?.centerId,undefined,"GLOBAL adapter does not claim BO Center scope");
});
test("PAP-1221 HO fails closed on incorrect Core center/detail/ID",async()=>{
 for(const data of [
  {centerId:center,localDate:"2026-10-31",diaries:[{...row,centerId:other}],hasMore:false,limit:100,offset:0},
  {centerId:center,localDate:"2026-10-31",diaries:[{...row,studentId:"bad"}],hasMore:false,limit:100,offset:0},
  {centerId:center,localDate:"2026-10-31",diaries:[],hasMore:true,limit:100,offset:0},
  {centerId:center,localDate:"2026-10-31",diaries:[row,row],hasMore:false,limit:100,offset:0},
 ]){
  await assert.rejects(readGlobalDiaries(reader(data).fn,center,"2026-10-31",new AbortController().signal));
 }
 await assert.rejects(readGlobalDiary(reader({...row,centerId:other}).fn,id,center,new AbortController().signal),/mismatch/);
 await assert.rejects(readGlobalDiary(reader({...row,id:other}).fn,id,center,new AbortController().signal),/mismatch/);
});
test("PAP-1221 HO rejects Core denial and missing date filter, no data fallback",async()=>{
 for(const code of [401,403,404,409,503]){
  await assert.rejects(readGlobalDiaries(reader(null,code).fn,"","2026-10-31",new AbortController().signal),new RegExp(String(code)));
 }
 const r=reader({});
 await assert.rejects(hoDiaryProvider.list(hoDiaryQuery,{surface:"HO"},r.fn,new AbortController().signal),/valid Diary day/);
 await assert.rejects(hoDiaryProvider.list(hoDiaryQueryForDay("2026-10-31"),{surface:"BO",centerId:center},r.fn,new AbortController().signal),/HO GLOBAL scope/);
 assert.equal(r.calls.length,0);
});
