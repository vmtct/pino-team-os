import test from "node:test";
import assert from "node:assert/strict";
import {diarySchema,diaryDefinition,diaryQuery,diaryFields,localDayToday,validDiaryDay,projectDiary,diaryProviderForDay,readCenterDay,readCenterDiary} from "./schema";

const center="01912345-6789-7abc-8def-0123456789ab",other="01912345-6789-7abc-8def-0123456789dd";
const id="01912345-6789-7abc-8def-0123456789ac";
const row={id,centerId:center,studentId:"01912345-6789-7abc-8def-0123456789ad",registeredByUserId:"01912345-6789-7abc-8def-0123456789ae",
 teachingContextKey:"class:2026-10-31",pathKey:"01912345-6789-7abc-8def-0123456789af",runningClassId:null,
 registeredAt:"2026-10-31T12:00:00.000Z",updatedAt:"2026-10-31T12:01:00.000Z",status:"REGISTERED" as const,notes:"Quan sát thật",
 interest:null,difficulty:null,version:1};
const wrap=(data:unknown,status=200)=>new Response(JSON.stringify({data}),{status,headers:{"content-type":"application/json"}});
function fetcher(data:unknown,status=200){
 const calls:string[]=[];const fn:typeof fetch=async input=>{calls.push(String(input));return wrap(data,status)};
 return {fn,calls};
}
test("PAP-1220 TDD registration: seven fixed Table columns and truthful submitted actor",()=>{
 assert.equal(diarySchema.key,"classroom-diaries");
 assert.equal(diaryDefinition.surface,"BO");
 assert.equal(diaryDefinition.detail.history.kind,"unavailable");
 assert.deepEqual(diaryQuery.visible,["student","mission","date","className","submitter","status","diaryCode"]);
 assert.equal(diaryFields.find(f=>f.key==="submitter")?.label,"Người Submit");
 assert.equal(diaryFields.find(f=>f.key==="mission")?.label,"Nhiệm vụ");
 assert.equal(diaryDefinition.drawer.actions.length,0);
});
test("PAP-1220 day selection uses VN local calendar and rejects invalid dates",()=>{
 assert.equal(localDayToday(new Date("2026-10-31T17:40:00.000Z")),"2026-11-01");
 for(const value of ["2026-02-30","2026-13-01","","2026-1-1"])assert.equal(validDiaryDay(value),false);
 assert.equal(validDiaryDay("2026-10-31"),true);
});
test("PAP-1220 source truthful: no linked Mission/Result, no fabricated Student/Submitter name",()=>{
 const projected=projectDiary(row);
 assert.equal(projected.student,row.studentId);
 assert.equal(projected.submitter,row.registeredByUserId);
 assert.equal(projected.mission,"Chưa liên kết nhiệm vụ");
 assert.equal(projected.missionCompleted,"Chưa xác nhận");
 assert.equal(projected.date,"2026-10-31");
 assert.equal(projected.status,"Đã ghi nhận");
 assert.equal(projected.notes,"Quan sát thật");
 const closed=projectDiary({...row,status:"CLOSED" as const});
 assert.equal(closed.missionCompleted,"Chưa xác nhận","CLOSED never means mission complete");
});
test("PAP-1220 accepts authorized Center page with correct Core provenance",async()=>{
 const {fn,calls}=fetcher({centerId:center,localDate:"2026-10-31",diaries:[row],limit:100,offset:0,hasMore:false});
 const rows=await readCenterDay(fn,center,"2026-10-31",new AbortController().signal);
 assert.equal(rows.length,1);assert.equal(rows[0]?.id,id);
 assert.match(calls[0]??"",/\/api\/bo\/learning\/path-diaries\?centerId=.*localDate=2026-10-31&limit=100&offset=0/);
 const provider=diaryProviderForDay("2026-10-31");
 const page=await provider.list(diaryQuery,{surface:"BO",centerId:center},fn,new AbortController().signal);
 assert.equal(page.total,1);assert.equal(page.records[0]?.centerId,center);
 assert.equal(page.records[0]?.row.id,id);
});
test("PAP-1220 detail verifies independent Core read and exact Center+ID",async()=>{
 const {fn,calls}=fetcher(row);
 const data=await readCenterDiary(fn,center,id,new AbortController().signal);
 assert.equal(data?.id,id);
 assert.ok(calls[0]?.includes("/api/bo/learning/path-diaries/"+id+"?centerId="+center));
});
test("PAP-1220 cross-Center row or substituted ID fails closed",async()=>{
 for(const data of [{...row,centerId:other},{...row,id:other},{...row,registeredByUserId:"Mentor Trang"},null]){
  const {fn}=fetcher(data);
  await assert.rejects(readCenterDiary(fn,center,id,new AbortController().signal),/Wrong Center\/invalid Diary detail/);
 }
});
test("PAP-1220 denied Core response does not become empty success",async()=>{
 for(const status of [401,403,404,409,503]){
  const {fn}=fetcher(null,status);
  await assert.rejects(readCenterDay(fn,center,"2026-10-31",new AbortController().signal),new RegExp(String(status)));
 }
});
test("PAP-1220 rejects false empty, wrong Center, bad provenance and truncation",async()=>{
 const samples=[
  {centerId:other,localDate:"2026-10-31",diaries:[],limit:100,offset:0,hasMore:false},
  {centerId:center,localDate:"2026-10-31",diaries:[{...row,studentId:"fake"}],limit:100,offset:0,hasMore:false},
  {centerId:center,localDate:"2026-10-31",diaries:[],limit:100,offset:0,hasMore:true},
  {centerId:center,localDate:"2026-10-31",diaries:[row,row],limit:100,offset:0,hasMore:false},
  [],
 ];
 for(const value of samples){
  const {fn}=fetcher(value);
  await assert.rejects(readCenterDay(fn,center,"2026-10-31",new AbortController().signal));
 }
});
