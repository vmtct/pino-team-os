import test from "node:test";
import assert from "node:assert/strict";
import {payrollDailyRow,displayDailyMoney,validDailyWindow} from "./bo-payroll-daily-view-model";
import type {DailyWorkRecord} from "./bo-payroll-daily-api";
const center="0199f001-0000-7000-8000-000000000001";
const base:DailyWorkRecord={
 base:{calculationVersion:"PAP-800-v1",centerId:center,staffMemberId:"01a18a28-6d8e-7db7-acbb-a18a942a5e72",
 workDate:"2026-11-13",status:"READY",paidMinutes:75,amountMinor:45000,
 hourlyRateMinor:36000,rateEntryId:"rate-id",rateVersion:2,
 assignmentIds:["assign-1"],sessionIds:["session-1"],correctionIds:[],coverageSourceIds:[],
 payableIntervals:[{startsAt:"2026-11-13T11:00:00Z",endsAt:"2026-11-13T12:15:00Z"}]},
 source:{coverage:[{assignmentId:"assign-1",coverageMode:"CLASSROOM_TIME",startLocal:"18:00",endLocal:"19:15"}],
  attendance:[{sessionId:"session-1",status:"CLOSED",recordedCheckInAt:"2026-11-13T10:58:00Z",
  recordedCheckOutAt:"2026-11-13T12:15:00Z",effectiveCheckInAt:"2026-11-13T11:00:00Z",
  effectiveCheckOutAt:"2026-11-13T12:15:00Z",correctionId:null}]},
 effective:{status:"READY",paidMinutes:75,amountMinor:45000},
 override:null,overrideStale:false,overrideVersion:0,sourceFingerprint:"x".repeat(64)
};
test("PAP-1954 renders only authoritative Core money, not recalculated browser salary",()=>{
 const row=payrollDailyRow(base,center);
 assert.equal(row.effectiveMinor,45000);
 assert.equal(row.standardMinor,45000);
 assert.equal(row.appliedRateMinor,36000);
 assert.equal(row.paidMinutes,75);
 assert.equal(displayDailyMoney(row.effectiveMinor),"45.000 ₫");
 assert.equal(row.actualInOut,"18:00–19:15");
 assert.equal(row.recordedInOut,"17:58–19:15");
 assert.equal(row.assignmentRefs,"assign-1");
 assert.equal(row.staffDisplayName,"—");
});
test("PAP-1954 rejects cross-Center projection even when client filter was selected",()=>{
 assert.throws(()=>payrollDailyRow(base,"other-center"),/CROSS_CENTER/);
});
test("PAP-1954 null money stays unavailable, not zero",()=>{
 const row=payrollDailyRow({...base,effective:{status:"RATE_MISSING",amountMinor:null,paidMinutes:null}},center);
 assert.equal(row.effectiveMinor,null);
 assert.equal(displayDailyMoney(null),"—");
});
test("PAP-1954 derived day four audit fields unavailable, override audit remains event only",()=>{
 const record={...base,override:{id:"override",version:1,paidMinutes:60,amountMinor:36000,
 reason:"approved synthetic",baseFingerprint:base.sourceFingerprint,
 createdByUserId:"user",createdAt:"2026-11-13T12:00:00Z"}};
 const row=payrollDailyRow(record,center);
 assert.deepEqual([row.createdAt,row.createdBy,row.updatedAt,row.updatedBy],["—","—","—","—"]);
 assert.equal(row.override?.createdByUserId,"user");
});
test("PAP-1954 exact local day window prevents invalid calendar and >31 inclusive days",()=>{
 assert.equal(validDailyWindow("2026-11-01","2026-12-01"),true);
 for(const [from,to] of [["2026-11-01","2026-12-02"],["2026-02-30","2026-03-01"],
  ["2026-11-03","2026-11-02"],["2026-11-01","2026-11-34"]])
  assert.equal(validDailyWindow(from,to),false);
});

test("PAP-1959 uses only verified Core names and keeps derived day audit unavailable",()=>{
 const row=payrollDailyRow({...base,staffLegalFullName:"Synthetic Verified Name"},center);
 assert.equal(row.staffDisplayName,"Synthetic Verified Name");
 assert.deepEqual([row.createdAt,row.createdBy,row.updatedAt,row.updatedBy],Array(4).fill("—"));
 assert.equal(row.effectiveMinor,base.effective.amountMinor);
 assert.equal(payrollDailyRow({...base,staffLegalFullName:null},center).staffDisplayName,"—");
});
