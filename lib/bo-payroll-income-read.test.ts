import test from "node:test";
import assert from "node:assert/strict";
import {scopedIncomeRow,loadIncomeHistory,type IncomePage} from "./bo-payroll-income-read";
import type {PeriodStaffPage,PayPeriod} from "./bo-payroll-period-api";
const period={id:"p",centerId:"c",name:"P",startDate:"2026-10-01",endDate:"2026-10-31",status:"ACTIVE"} as PayPeriod;
const page={period,totalsScope:"FULL_PERIOD",offset:0,nextOffset:null,rows:[{staffMemberId:"s",staffName:"Name",status:"FINALIZED",settlementId:"f",amountMinor:100,preview:{centerId:"c",periodId:"p",staffMemberId:"s",periodStartDate:period.startDate,periodEndDate:period.endDate,amountMinor:100,days:[]}}]} as unknown as PeriodStaffPage;
test("PAP-2012 preserves Core signed snapshot",()=>assert.equal(scopedIncomeRow(page,"c","p","s")?.staff.amountMinor,100));
test("PAP-2012 rejects foreign snapshot and missing frozen snapshot",()=>{
 assert.throws(()=>scopedIncomeRow(page,"other","p","s"),/SCOPE_MISMATCH/);
 assert.throws(()=>scopedIncomeRow({...page,rows:[{...page.rows[0],preview:null}]},"c","p","s"),/SNAPSHOT_MISSING/);
});
test("PAP-2012 scoped history rejects other staff, Center, duplicated period and invalid cursor",async()=>{
 const data:IncomePage={centerId:"c",staffMemberId:"s",anchorPeriodId:"p",current:{period,staff:page.rows[0]},rows:[],offset:0,nextOffset:null};
 const api={incomeHistory:async()=>({data})};
 assert.equal((await loadIncomeHistory("c","p","s",0,api)).current.staff.amountMinor,100);
 await assert.rejects(loadIncomeHistory("c","p","absent",0,api),/SCOPE_MISMATCH/);
 await assert.rejects(loadIncomeHistory("other","p","s",0,api),/SCOPE_MISMATCH/);
 await assert.rejects(loadIncomeHistory("c","p","s",0,{incomeHistory:async()=>({data:{...data,rows:[data.current]}})}),/SCOPE_MISMATCH/);
 await assert.rejects(loadIncomeHistory("c","p","s",0,{incomeHistory:async()=>({data:{...data,nextOffset:0}})}),/SCOPE_MISMATCH/);
});

