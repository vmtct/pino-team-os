import test from "node:test";
import assert from "node:assert/strict";
import {scopedIncomeRow,loadIncomeHistory,scopedIncomeDay,verifiedCompensationRows,type IncomePage} from "./bo-payroll-income-read";
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


test("PAP-2012 daily detail reads only the chosen period snapshot",()=>{
 const day={workDate:"2026-10-04",status:"READY",paidMinutes:60,amountMinor:100};
 const row={period,staff:{...page.rows[0],preview:{...page.rows[0].preview!,days:[day]}}};
 assert.equal(scopedIncomeDay(row,day.workDate),day);
 assert.equal(scopedIncomeDay(row,"2026-11-04"),null);
 assert.equal(scopedIncomeDay({...row,staff:{...row.staff,preview:{...row.staff.preview,days:[day,day]}}},day.workDate),null);
});
test("PAP-2012 private compensation rejects mismatched identity, currency and duplicate rates",()=>{
 const row={id:"rate",staffMemberId:"s",effectiveFrom:"2026-10-01",periodUntilExclusive:null,state:"CURRENT" as const,amountMinor:100,currency:"VND" as const,note:null,version:1,updatedAt:"2026-10-01T00:00:00Z"};
 assert.deepEqual(verifiedCompensationRows([row],"s"),[row]);
 assert.throws(()=>verifiedCompensationRows([row],"other"),/Invalid compensation scope/);
 assert.throws(()=>verifiedCompensationRows([row,row],"s"),/Invalid compensation scope/);
 assert.throws(()=>verifiedCompensationRows([{...row,amountMinor:-1}],"s"),/Invalid compensation scope/);
});