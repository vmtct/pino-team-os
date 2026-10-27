import test from "node:test";
import assert from "node:assert/strict";
import {periodDisplayName,periodSummaries,staffWithWorkEvidence} from "./bo-payroll-read-model";
import type {PeriodStaff,PeriodStaffPage} from "./bo-payroll-period-api";
test("period name derives exclusively from START month and canonical center",()=>{
 assert.equal(periodDisplayName("2026-10-31","PINO Cần Thơ"),"Lương tháng 10 - PINO Cần Thơ");
 assert.equal(periodDisplayName("2026-11-01","PINO Cần Thơ"),"Lương tháng 11 - PINO Cần Thơ");
 assert.equal(periodDisplayName("2027-01-01","PINO Cần Thơ"),"Lương tháng 1 - PINO Cần Thơ");
 assert.equal(periodDisplayName("bad-date","PINO Cần Thơ"),"Kỳ lương chưa đủ dữ liệu");
});
test("expected uses Core FULL_PERIOD known amount; settlement uses finalized+prior paid immutable snapshots",()=>{
 const totals={knownMinor:470250,draftMinor:206250,finalizedMinor:96000,paidMinor:168000,pendingProvisionalMinor:0,draftCount:1,pendingCount:2,finalizedCount:1,paidCount:1,archivedUnavailableCount:0,hasPending:true,hasUnavailable:false} satisfies PeriodStaffPage["periodTotals"];
 assert.deepEqual(periodSummaries(totals),{expected:470250,finalized:264000});
});
test("no prepopulated staff: only explicit paid time or finalized immutable settlement",()=>{
 const base={staffMemberId:"PTE-test",status:"PENDING",amountMinor:null,provisionalAmountMinor:null,warnings:[],settlementId:null,preview:null} satisfies PeriodStaff;
 const rows:PeriodStaff[]=[
  base,
  {...base,staffMemberId:"PTE-timed",status:"DRAFT",amountMinor:10000,preview:{centerId:"center",periodId:"period",periodVersion:1,periodStartDate:"2026-10-01",periodEndDate:"2026-10-31",staffMemberId:"PTE-timed",amountMinor:10000,adjustmentsMinor:0,extraTimeMinor:0,days:[{workDate:"2026-10-02",status:"READY",paidMinutes:30,amountMinor:10000}],adjustments:[],extraTimeDecisions:[],warnings:[],sourceFingerprint:"test"}},
  {...base,staffMemberId:"PTE-finalized",status:"FINALIZED",amountMinor:20000},
 ];
 assert.deepEqual(staffWithWorkEvidence(rows).map(x=>x.staffMemberId),["PTE-timed","PTE-finalized"]);
});
