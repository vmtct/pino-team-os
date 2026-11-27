import test from "node:test";
import assert from "node:assert/strict";
import {
  availableExtraTimeWindows,createExtraTimePayload,formatVietnamTime,caLamExtraTimeHref,caLamIncomeHref,scopedExtraTimeCenter,
  type AttendanceEvidence,type OwnShift,
} from "./tos-payroll-extra-time-api";

const center="center-a",day="2026-10-20";
const assignments:OwnShift[]=[
  {id:"shift-a",centerId:center,workDate:day,status:"ACTIVE",shift:{displayLabel:"Ca chiều"}},
  {id:"shift-b",centerId:"center-b",workDate:day,status:"ACTIVE",shift:{displayLabel:"Other center"}},
  {id:"shift-c",centerId:center,workDate:day,status:"CANCELLED",shift:null},
];
const attendance:AttendanceEvidence[]=[
  {id:"attendance-a",centerId:center,assignmentId:"shift-a",workDate:day,
   status:"CLOSED",checkInAt:"2026-10-20T18:05:00+07:00",checkOutAt:"2026-10-20T20:59:00+07:00"},
  {id:"attendance-b",centerId:"center-b",assignmentId:"shift-b",workDate:day,
   status:"CLOSED",checkInAt:"2026-10-20T18:00:00+07:00",checkOutAt:"2026-10-20T19:00:00+07:00"},
  {id:"attendance-c",centerId:center,assignmentId:"shift-c",workDate:day,
   status:"CLOSED",checkInAt:"2026-10-20T18:00:00+07:00",checkOutAt:"2026-10-20T21:00:00+07:00"},
  {id:"attendance-open",centerId:center,assignmentId:"shift-a",workDate:day,
   status:"OPEN",checkInAt:"2026-10-20T18:00:00+07:00",checkOutAt:null},
];
const option=availableExtraTimeWindows(assignments,attendance,center)[0]!;
test("PAP-802 UI only offers CLOSED own-center active assignment days",()=>{
  const options=availableExtraTimeWindows(assignments,attendance,center);
  assert.equal(options.length,1);
  assert.equal(options[0]?.assignmentId,"shift-a");
  assert.equal(options[0]?.label,day+" · Ca chiều");
});
test("PAP-802 UI builds Vietnam-local, staff-ID-free Core payload",()=>{
  const result=createExtraTimePayload(option,center,"18:10","18:30","Room setup took extra effort");
  assert.deepEqual(result,{
    centerId:center,assignmentId:"shift-a",workDate:day,
    startAt:"2026-10-20T18:10:00+07:00",endAt:"2026-10-20T18:30:00+07:00",
    reason:"Room setup took extra effort",
  });
  assert.equal("staffMemberId" in result,false);
});
test("PAP-802 UI validates recorded window, clock order, reason and max duration",()=>{
  assert.throws(()=>createExtraTimePayload(option,center,"18:00","18:30","A valid lengthy reason"));
  assert.throws(()=>createExtraTimePayload(option,center,"18:20","21:00","A valid lengthy reason"));
  assert.throws(()=>createExtraTimePayload(option,center,"19:00","18:30","A valid lengthy reason"));
  assert.throws(()=>createExtraTimePayload(option,center,"18:05","18:15","Short"));
  assert.throws(()=>createExtraTimePayload(option,center,"25:00","18:15","A valid lengthy reason"));
  assert.throws(()=>createExtraTimePayload(undefined,center,"18:05","18:15","A valid lengthy reason"));
});
test("PAP-802 UI formats source timestamps in Vietnam local clock",()=>{
  assert.equal(formatVietnamTime("2026-10-20T11:05:00.000Z"),"18:05");
  assert.equal(formatVietnamTime("garbage"),"--:--");
});

test("PAP-2429 extra-time uses latest effective attendance, rejects unknown duration and stale Center choice",()=>{
 const corrected:AttendanceEvidence={...attendance[0]!,effective:{
  checkInAt:"2026-10-20T18:30:00+07:00",checkOutAt:"2026-10-20T21:15:00+07:00",durationSeconds:9900}};
 const choice=availableExtraTimeWindows(assignments,[corrected],center)[0]!;
 assert.equal(choice.checkInAt,"2026-10-20T18:30:00+07:00");
 assert.equal(choice.checkOutAt,"2026-10-20T21:15:00+07:00");
 assert.throws(()=>createExtraTimePayload(choice,center,"18:10","18:20","Valid setup work description"));
 assert.equal(createExtraTimePayload(choice,center,"21:00","21:10","Valid setup work description").endAt,"2026-10-20T21:10:00+07:00");
 assert.throws(()=>createExtraTimePayload(choice,"center-b","21:00","21:10","Valid setup work description"));
 assert.deepEqual(availableExtraTimeWindows(assignments,[{...corrected,effective:{...corrected.effective!,durationSeconds:null}}],center),[]);
});
test("PAP-2429 fixed extra-time entry/return routes preserve only an authorized Staff Center",()=>{
 const ctx={staffMemberId:"self",centers:[{id:"center-a"},{id:"center-b"}]};
 const entry=new URL(caLamExtraTimeHref("center-b"),"https://example.test");
 const back=new URL(caLamIncomeHref("center-b"),"https://example.test");
 assert.equal(entry.pathname,"/earnings/extra-time");
 assert.equal(back.pathname,"/tos-v4");
 assert.equal(scopedExtraTimeCenter(entry.search,"ca-lam",ctx),"center-b");
 assert.equal(scopedExtraTimeCenter(back.search,"extra-time",ctx),"center-b");
 assert.equal(scopedExtraTimeCenter("","ca-lam",ctx),null);
 for(const query of ["?from=ca-lam&centerId=foreign","?from=ca-lam","?from=ca-lam&centerId=center-a&centerId=center-b","?from=ca-lam&from=other&centerId=center-a"]){
  assert.equal(scopedExtraTimeCenter(query,"ca-lam",ctx),"");
 }
 assert.equal(scopedExtraTimeCenter(entry.search,"ca-lam",{...ctx,staffMemberId:null}),"");
 assert.equal(scopedExtraTimeCenter(entry.search,"ca-lam",{...ctx,founderMode:true}),"");
 assert.equal(scopedExtraTimeCenter(entry.search+"&return=https://evil.test","ca-lam",ctx),"center-b");
});