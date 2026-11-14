import test from "node:test";
import assert from "node:assert/strict";
import {nativePeriodRow,validNativePeriodDates} from "./bo-payroll-native-period-model";
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
