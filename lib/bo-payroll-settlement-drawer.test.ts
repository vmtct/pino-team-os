import assert from "node:assert/strict";
import test from "node:test";
import {settlementDrawerSource,settlementDrawerExceptions,pendingSettlementException,settlementExceptionDetail,settlementDrawerHref,settlementExceptionHref} from "./bo-payroll-settlement-drawer";
import type {IncomePeriod} from "./bo-payroll-income-read";
import type {NativeReviewedException} from "./bo-payroll-exceptions-read";
const period={id:"period",name:"P",startDate:"2026-10-01",endDate:"2026-10-31",status:"ACTIVE" as const};
const preview={centerId:"center",periodId:"period",staffMemberId:"staff",periodStartDate:period.startDate,periodEndDate:period.endDate,periodVersion:1,days:[],adjustments:[],adjustmentsMinor:0,extraTimeDecisions:[],extraTimeMinor:0,warnings:[],sourceFingerprint:"abc",amountMinor:123};
const row:IncomePeriod={period,staff:{staffMemberId:"staff",status:"DRAFT",amountMinor:123,provisionalAmountMinor:null,warnings:[],preview,settlementId:null}};
const request:NativeReviewedException={id:"r1",centerId:"center",staffMemberId:"staff",workDate:"2026-10-02",assignmentId:"a",requestedStartAt:"2026-10-02T10:00:00+07:00",requestedEndAt:"2026-10-02T10:30:00+07:00",requestReason:"Synthetic",status:"PENDING",decision:null};
const list=(rows:NativeReviewedException[])=>({data:{data:rows,total:rows.length,nextOffset:null}});
const reader=(rows:NativeReviewedException[])=>({list:async()=>list(rows),detail:async()=>({data:request})});
test("PAP-1956 drawer rejects foreign Center and duplicate or out-of-period days",()=>{
 assert.equal(settlementDrawerSource(row,"center","period","staff").preview.amountMinor,123);
 assert.throws(()=>settlementDrawerSource(row,"other","period","staff"),/SCOPE_MISMATCH/);
 const day={workDate:"2026-11-02",status:"READY",paidMinutes:30,amountMinor:10};
 assert.throws(()=>settlementDrawerSource({...row,staff:{...row.staff,preview:{...preview,days:[day]}}},"center","period","staff"),/SOURCE_MISMATCH/);
});
test("PAP-1956 drawer projects only selected staff and denies foreign Center or incomplete page",async()=>{
 assert.deepEqual(await settlementDrawerExceptions(row,"center","period","staff",reader([request,{...request,id:"r2",staffMemberId:"other"}])),[request]);
 await assert.rejects(settlementDrawerExceptions(row,"center","period","staff",reader([{...request,centerId:"other"}])),/EXCEPTION_SCOPE/);
 await assert.rejects(settlementDrawerExceptions(row,"center","period","staff",{...reader([]),list:async()=>({data:{data:[request],total:2,nextOffset:null}})}),/EXCEPTION_PAGE/);
 assert.equal(pendingSettlementException([], [request]),true);
 assert.equal(pendingSettlementException(["EXTRA_TIME_PENDING:2026-10-02:1"],[]),true);
 assert.equal(pendingSettlementException([], [{...request,status:"WITHDRAWN"}]),false);
});
test("PAP-1956 frozen snapshot reads only explicit immutable decision IDs and preserves amount",async()=>{
 const decided:NativeReviewedException={...request,status:"APPROVED",decision:{id:"decision",type:"APPROVED",startAt:request.requestedStartAt,endAt:request.requestedEndAt,minutes:30,hourlyRateMinor:40,rateEntryId:"rate",rateVersion:1,amountMinor:20,reason:"Synthetic approved",reviewerId:"reviewer",reviewedAt:"2026-10-02T04:00:00Z",sourceFingerprint:"x"}};
 const frozen:IncomePeriod={...row,staff:{...row.staff,status:"FINALIZED",settlementId:"settled",preview:{...preview,extraTimeDecisions:[{id:"decision",requestId:"r1",workDate:request.workDate,decision:"APPROVED",amountMinor:20}]}}};
 const api={list:async()=>{throw Error("must not query live list")},detail:async()=>({data:decided})};
 assert.deepEqual(await settlementDrawerExceptions(frozen,"center","period","staff",api),[decided]);
 await assert.rejects(settlementDrawerExceptions(frozen,"center","period","staff",{...api,detail:async()=>({data:request})}),/SNAPSHOT_EXCEPTION_MISMATCH/);
 assert.equal(settlementDrawerSource(frozen,"center","period","staff").staff.amountMinor,123);
});

test("PAP-1956 integrated exception detail checks PTE, period, Center and frozen membership",async()=>{
 assert.deepEqual(await settlementExceptionDetail(row,"center","period","staff","r1",reader([])),request);
 for(const invalid of [{...request,id:"other"},{...request,centerId:"other"},{...request,staffMemberId:"other"},{...request,workDate:"2026-11-01"}])
  await assert.rejects(settlementExceptionDetail(row,"center","period","staff","r1",{detail:async()=>({data:invalid})}),/EXCEPTION_SCOPE/);
 const frozen:IncomePeriod={...row,staff:{...row.staff,status:"FINALIZED",settlementId:"settled"}};
 await assert.rejects(settlementExceptionDetail(frozen,"center","period","staff","r1",{detail:async()=>{throw Error("must not call detail")}}),/NOT_IN_SNAPSHOT/);
 const url=new URL(settlementExceptionHref("c","p","s","r"),"https://bo.invalid");
 assert.equal(url.pathname,"/bo/payroll-periods");
 assert.deepEqual(Object.fromEntries(url.searchParams),{centerId:"c",record:"p",incomeStaff:"s",incomeException:"r"});
 assert.equal(settlementDrawerHref("c","p","s"),"/bo/payroll-periods?centerId=c&record=p&tab=settlements&incomeDrawer=s");
});

test("PAP-1956 signed adjustments are read from the exact snapshot; malformed or duplicate entries rejected",()=>{
 const adjustments=[{id:"bonus",amountMinor:1200,reason:"Synthetic bonus"},{id:"deduction",amountMinor:-200,reason:"Synthetic deduction"}];
 const make=(items:typeof adjustments)=>({...row,staff:{...row.staff,preview:{...preview,adjustments:items,adjustmentsMinor:1000}}});
 assert.deepEqual(settlementDrawerSource(make(adjustments),"center","period","staff").preview.adjustments,adjustments);
 assert.throws(()=>settlementDrawerSource(make([adjustments[0],adjustments[0]]),"center","period","staff"),/SOURCE_MISMATCH/);
 assert.throws(()=>settlementDrawerSource(make([{...adjustments[0],amountMinor:1.5}]),"center","period","staff"),/SOURCE_MISMATCH/);
});