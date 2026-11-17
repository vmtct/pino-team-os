import assert from "node:assert/strict";
import test from "node:test";
import {settlementDrawerSource,settlementDrawerExceptions,pendingSettlementException,settlementReadiness,canReviewSettlementException,verifiedReviewReceipt,validatedAdjustmentInput,projectAdjustmentDraft,verifiedSettlementPreview,settlementExceptionDetail,settlementDrawerHref,settlementExceptionHref} from "./bo-payroll-settlement-drawer";
import {decisionPayload} from "./bo-payroll-extra-review-api";
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
test("PAP-1956 read-only readiness fails closed without exact capability and complete exception evidence",()=>{
 const ready=settlementDrawerSource({...row,staff:{...row.staff,preview:{...preview,sourceFingerprint:"a".repeat(64)}}},"center","period","staff");
 const capability={centerId:"center",canManageSettlement:true,canReviewExtraTime:true};
 assert.equal(settlementReadiness(ready,capability,"center",[],""),"PREVIEW_REQUIRED");
 assert.equal(settlementReadiness(ready,undefined,"center",[],""),"NO_CAPABILITY");
 assert.equal(settlementReadiness(ready,{...capability,centerId:"other"},"center",[],""),"NO_CAPABILITY");
 assert.equal(settlementReadiness(ready,capability,"center",[],"source unavailable"),"EXCEPTIONS_UNVERIFIED");
 assert.equal(settlementReadiness(ready,capability,"center",[{...request,staffMemberId:"other"}],""),"EXCEPTIONS_UNVERIFIED");
 assert.equal(settlementReadiness(ready,capability,"center",[request],""),"PENDING_EXCEPTION");
 assert.equal(settlementReadiness({...ready,preview:{...ready.preview,warnings:["EXTRA_TIME_PENDING:2026-10-02:1"]}},capability,"center",[],""),"PENDING_EXCEPTION");
 assert.equal(settlementReadiness({...ready,frozen:true},capability,"center",[],""),"LOCKED");
 assert.equal(settlementReadiness({...ready,period:{...ready.period,status:"ARCHIVED"}},capability,"center",[],""),"LOCKED");
 assert.equal(settlementReadiness({...ready,preview:{...ready.preview,sourceFingerprint:"invalid"}},capability,"center",[],""),"SOURCE_UNVERIFIED");
});
test("PAP-1956 fresh Core preview must retain exact selected source before confirmation",()=>{
 const fresh={...preview,sourceFingerprint:"a".repeat(64)};
 const source=settlementDrawerSource({...row,staff:{...row.staff,preview:fresh}},"center","period","staff");
 assert.equal(verifiedSettlementPreview(source,fresh),fresh);
 for(const bad of [{...fresh,centerId:"other"},{...fresh,staffMemberId:"other"},{...fresh,periodVersion:2},{...fresh,amountMinor:124},{...fresh,sourceFingerprint:"b".repeat(64)},{...fresh,warnings:["EXTRA_TIME_PENDING:2026-10-02:1"]}])
  assert.throws(()=>verifiedSettlementPreview(source,bad),/tải lại/);
 assert.throws(()=>verifiedSettlementPreview({...source,frozen:true},fresh),/tải lại/);
});

test("PAP-1956 integrated review eligibility is exact Center, PTE, request and pending state",()=>{
 const source=settlementDrawerSource(row,"center","period","staff");
 const rights={centerId:"center",canManageSettlement:false,canReviewExtraTime:true};
 assert.equal(canReviewSettlementException(source,rights,"center","r1",request),true);
 for(const invalid of [{...request,id:"other"},{...request,centerId:"other"},{...request,staffMemberId:"other"},{...request,workDate:"2026-11-01"},{...request,status:"WITHDRAWN" as const}])
  assert.equal(canReviewSettlementException(source,rights,"center","r1",invalid),false);
 assert.equal(canReviewSettlementException(source,{...rights,canReviewExtraTime:false},"center","r1",request),false);
 assert.equal(canReviewSettlementException(source,{...rights,centerId:"other"},"center","r1",request),false);
 assert.equal(canReviewSettlementException({...source,frozen:true},rights,"center","r1",request),false);
 assert.equal(canReviewSettlementException({...source,period:{...source.period,status:"ARCHIVED"}},rights,"center","r1",request),false);
});

test("PAP-1956 adjustment input preserves exact signed VND and Core reason bounds without a transport",()=>{
 assert.deepEqual(validatedAdjustmentInput("+1200","  Bổ sung  "),{amountMinor:1200,reason:"Bổ sung"});
 assert.deepEqual(validatedAdjustmentInput("-1200","Điều chỉnh"),{amountMinor:-1200,reason:"Điều chỉnh"});
 assert.equal(validatedAdjustmentInput("1000000000000","abc").amountMinor,1000000000000);
 for(const bad of ["","0","-0","+0","1.2","1e3","1,000","1 000","1000000000001","-1000000000001","Infinity"])
  assert.throws(()=>validatedAdjustmentInput(bad,"abc"));
 for(const bad of [""," a ","x".repeat(501)])assert.throws(()=>validatedAdjustmentInput("100",bad));
});

test("PAP-1956 adjustment draft estimate enforces approved prototype nonnegative total and exact scope",()=>{
 const src=settlementDrawerSource({...row,staff:{...row.staff,preview:{...preview,sourceFingerprint:"a".repeat(64)}}},"center","period","staff");
 const rights={centerId:"center",canManageSettlement:true,canReviewExtraTime:false};
 assert.deepEqual(projectAdjustmentDraft(src,rights,"center","-123","abc"),{amountMinor:-123,reason:"abc",currentAmountMinor:123,projectedAmountMinor:0});
 assert.equal(projectAdjustmentDraft(src,rights,"center","+1","abc").projectedAmountMinor,124);
 assert.throws(()=>projectAdjustmentDraft(src,rights,"center","-124","abc"));
 assert.throws(()=>projectAdjustmentDraft(src,rights,"center","1000000000000","abc"));
 assert.throws(()=>projectAdjustmentDraft(src,{...rights,centerId:"other"},"center","1","abc"));
 assert.throws(()=>projectAdjustmentDraft(src,{...rights,canManageSettlement:false},"center","1","abc"));
 assert.throws(()=>projectAdjustmentDraft({...src,frozen:true},rights,"center","1","abc"));
 assert.throws(()=>projectAdjustmentDraft({...src,preview:{...src.preview,sourceFingerprint:"bad"}},rights,"center","1","abc"));
});

test("PAP-1956 review receipt verifies exact request, scope, decision and independently read back values",()=>{
 const payload=decisionPayload(request,"FULL","","","Synthetic approved");
 const decided:NativeReviewedException={...request,status:"APPROVED",decision:{id:"decision",type:"APPROVED",startAt:request.requestedStartAt,endAt:request.requestedEndAt,minutes:30,hourlyRateMinor:40,rateEntryId:"rate",rateVersion:1,amountMinor:20,reason:payload.reason,reviewerId:"reviewer",reviewedAt:"2026-10-02T04:00:00Z",sourceFingerprint:"x"}};
 assert.equal(verifiedReviewReceipt(request,decided,decided,payload),decided);
 for(const bad of [{...decided,centerId:"other"},{...decided,staffMemberId:"other"},{...decided,assignmentId:"other"},{...decided,workDate:"2026-10-03"},{...decided,id:"other"},{...decided,decision:null},{...decided,decision:{...decided.decision!,amountMinor:21}},{...decided,decision:{...decided.decision!,endAt:"2026-10-02T10:20:00+07:00"}}]){
  assert.throws(()=>verifiedReviewReceipt(request,decided,bad,payload),/READBACK_UNVERIFIED/);
  assert.throws(()=>verifiedReviewReceipt(request,bad,decided,payload),/READBACK_UNVERIFIED/);
 }
 const rejectedPayload=decisionPayload(request,"REJECTED","","","Synthetic rejected");
 const rejected:NativeReviewedException={...request,status:"REJECTED",decision:{...decided.decision!,type:"REJECTED",reason:rejectedPayload.reason,startAt:null,endAt:null,minutes:null,amountMinor:null,hourlyRateMinor:null,rateEntryId:null,rateVersion:null,sourceFingerprint:null}};
 assert.equal(verifiedReviewReceipt(request,rejected,rejected,rejectedPayload),rejected);
 assert.throws(()=>verifiedReviewReceipt(request,rejected,{...rejected,decision:{...rejected.decision!,startAt:request.requestedStartAt}},rejectedPayload),/READBACK_UNVERIFIED/);
});
