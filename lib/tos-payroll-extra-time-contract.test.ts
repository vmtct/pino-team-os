import test from "node:test";
import assert from "node:assert/strict";
import {
  availableExtraTimeWindows,createExtraTimePayload,formatVietnamTime,
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
