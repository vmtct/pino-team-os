import test from "node:test";
import assert from "node:assert/strict";
import {nativePeriodRow,validNativePeriodDates,mayCancelNativePeriod,nativePeriodStatus,nativePeriodHistory} from "./bo-payroll-native-period-model";
import type {BoPayPeriodRead,PeriodStaffPage} from "./bo-payroll-period-api";
const period:BoPayPeriodRead={id:"period",centerId:"center",name:"legacy",startDate:"2026-02-27",endDate:"2026-03-03",status:"ACTIVE",version:1,dateLocked:false,createdAt:"2026-02-01T00:00:00Z",updatedAt:null};
const rollup:PeriodStaffPage={period:{id:period.id,name:period.name,startDate:period.startDate,endDate:period.endDate,status:period.status},rows:[],totalStaffCount:0,limit:25,offset:0,nextOffset:null,totalsScope:"FULL_PERIOD",periodTotals:{knownMinor:62400,draftMinor:0,finalizedMinor:62400,paidMinor:0,pendingProvisionalMinor:0,draftCount:0,pendingCount:0,finalizedCount:1,paidCount:0,archivedUnavailableCount:0,hasPending:false,hasUnavailable:false},asOf:"2026-02-01"};
test("PAP-1985 date-only input rejects impossible dates and reversed ranges",()=>{
 assert.equal(validNativePeriodDates(period),true);
 assert.equal(validNativePeriodDates({startDate:"2026-02-30",endDate:"2026-03-03"}),false);
 assert.equal(validNativePeriodDates({startDate:"2026-03-04",endDate:"2026-03-03"}),false);
});
test("PAP-1985 native row preserves Core full-period amount, start-month title and missing actors",()=>{
 const row=nativePeriodRow(period,rollup,"center","Cần Thơ");
 assert.equal(row.name,"Lương tháng 2 - Cần Thơ");
 assert.equal(row.expected,62400);assert.equal(row.finalized,62400);
 assert.equal(row.createdActor,"—");assert.equal(row.modifiedActor,"—");
 assert.equal(row.modifiedTime,"—");
 assert.equal(nativePeriodRow(period,{...rollup,nextOffset:25},"center","Cần Thơ").staffCount,null);
});
test("PAP-1985 rejects foreign center, period and stale rollup dates",()=>{
 assert.throws(()=>nativePeriodRow(period,rollup,"other","Cần Thơ"),/SCOPE_MISMATCH/);
 assert.throws(()=>nativePeriodRow(period,{...rollup,period:{...rollup.period,id:"other"}},"center","Cần Thơ"),/SCOPE_MISMATCH/);
 assert.throws(()=>nativePeriodRow(period,{...rollup,period:{...rollup.period,endDate:"2026-03-04"}},"center","Cần Thơ"),/SCOPE_MISMATCH/);
});
test("PAP-1990 cancellation status and opt-in capability are fail-closed",()=>{
 const active=period;
 assert.equal(mayCancelNativePeriod(active),false);
 assert.equal(mayCancelNativePeriod({...active,canCancel:true}),true);
 assert.equal(mayCancelNativePeriod({...active,canCancel:true,dateLocked:true}),false);
 assert.equal(mayCancelNativePeriod({...active,canCancel:true,status:"ARCHIVED"}),false);
 assert.equal(nativePeriodStatus({...active,status:"ARCHIVED"}),"Lưu trữ");
 assert.equal(nativePeriodStatus({...active,status:"ARCHIVED",canceledAt:"2026-11-14T00:00:00Z"}),"Đã hủy");
});

test("PAP-1985 full count is independent of pagination, invalid count denies",()=>{
 assert.equal(nativePeriodRow(period,{...rollup,totalStaffCount:40,staffWithWorkEvidenceCount:31,nextOffset:25},"center","Cần Thơ").staffCount,31);
 assert.throws(()=>nativePeriodRow(period,{...rollup,staffWithWorkEvidenceCount:1},"center","Cần Thơ"),/COUNT_MISMATCH/);
});
test("PAP-1985 only scoped authoritative timeline events render",()=>{
 const page={centerId:"center",periodId:"period",offset:0,nextOffset:null,events:[{id:"event",action:"PAYROLL_PERIOD_CANCELLED",occurredAt:"2026-11-14T00:00:00Z",actorName:null}]};
 assert.equal(nativePeriodHistory(page,"center","period",0)[0]?.action,"Hủy kỳ lương");
 assert.throws(()=>nativePeriodHistory(page,"other","period",0),/SCOPE_MISMATCH/);
 assert.throws(()=>nativePeriodHistory({...page,events:[{...page.events[0]!,action:"SECRET"}]},"center","period",0),/EVENT_INVALID/);
});
