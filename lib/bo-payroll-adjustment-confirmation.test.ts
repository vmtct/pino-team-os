import assert from "node:assert/strict";
import test from "node:test";
import {confirmAdjustment,type AdjustmentCommand,type AdjustmentConfirmationIO} from "./bo-payroll-adjustment-confirmation";
import {settlementDrawerSource,projectAdjustmentDraft} from "./bo-payroll-settlement-drawer";
import type {IncomePage,IncomePeriod} from "./bo-payroll-income-read";
import type {SettlementPreview} from "./bo-payroll-period-api";
const centerId="center",periodId="period",staffId="staff";
const period={id:periodId,name:"Fixture",startDate:"2026-11-01",endDate:"2026-11-30",status:"ACTIVE" as const};
const before: SettlementPreview={centerId,periodId,staffMemberId:staffId,periodStartDate:period.startDate,periodEndDate:period.endDate,periodVersion:1,amountMinor:10000,adjustmentsMinor:0,extraTimeMinor:0,days:[],adjustments:[],extraTimeDecisions:[],warnings:[],sourceFingerprint:"a".repeat(64)};
const rights={centerId,canManageSettlement:true,canReviewExtraTime:false};
const page=(preview: SettlementPreview=before,capability:unknown=rights):IncomePage=>{
 const current:IncomePeriod={period,staff:{staffMemberId:staffId,status:"DRAFT",amountMinor:preview.amountMinor,provisionalAmountMinor:null,warnings:[],preview,settlementId:null}};
 return {centerId,anchorPeriodId:periodId,staffMemberId:staffId,current,rows:[],offset:0,nextOffset:null,financialCapabilities:capability};
};
const source=settlementDrawerSource(page().current,centerId,periodId,staffId);
const draft=projectAdjustmentDraft(source,rights,centerId,"-1000","Synthetic deduction");
const entry={id:"adjustment",amountMinor:draft.amountMinor,reason:draft.reason};
const receipt={...entry,centerId,periodId,staffMemberId:staffId,category:null,reversesAdjustmentId:null,createdByUserId:"founder",createdAt:"2026-11-02T01:00:00Z"};
const after={...before,amountMinor:9000,adjustmentsMinor:-1000,adjustments:[entry],sourceFingerprint:"b".repeat(64)};
function fixture(first=page(),last=page(after),response:unknown=receipt){
 const commands:AdjustmentCommand[]=[];let reads=0;
 const io:AdjustmentConfirmationIO={read:async(c,p,s)=>{assert.deepEqual([c,p,s],[centerId,periodId,staffId]);return reads++===0?first:last},submit:async(c)=>{commands.push(c);return response},nonce:()=>"synthetic-123",active:()=>true};
 return {io,commands,reads:()=>reads};
}
test("PAP-1956 confirmation rechecks selected draft, sends exact CAS once and verifies independent readback",async()=>{
 const f=fixture();assert.deepEqual(await confirmAdjustment(source,draft,f.io),page(after));
 assert.deepEqual(f.commands,[{centerId,periodId,staffId,amountMinor:-1000,reason:draft.reason,expectedFingerprint:before.sourceFingerprint,idempotencyKey:"pay-adjust-"+before.sourceFingerprint+":synthetic-123"}]);
 assert.equal(f.reads(),2);
});
test("PAP-1956 confirmation fails before submission on revoked capability, stale source or edited draft",async()=>{
 for(const p of [page(before,{...rights,canManageSettlement:false}),page({...before,sourceFingerprint:"c".repeat(64)}),{...page(),centerId:"other"}]){
  const f=fixture(p);await assert.rejects(confirmAdjustment(source,draft,f.io),{submitted:false});assert.equal(f.commands.length,0);
 }
 const f=fixture();await assert.rejects(confirmAdjustment(source,{...draft,projectedAmountMinor:1},f.io),{submitted:false});assert.equal(f.commands.length,0);
 let active=true;const cancelled=fixture();cancelled.io.active=()=>active;const read=cancelled.io.read;cancelled.io.read=async(...args)=>{const result=await read(...args);active=false;return result};
 await assert.rejects(confirmAdjustment(source,draft,cancelled.io),{submitted:false});assert.equal(cancelled.commands.length,0);
});
test("PAP-1956 uncertain submission or wrong receipt/readback never retries automatically",async()=>{
 for(const f of [fixture(page(),page(),receipt),fixture(page(),page(after),{...receipt,amountMinor:1000})]){
  await assert.rejects(confirmAdjustment(source,draft,f.io),{submitted:true});assert.equal(f.commands.length,1);
 }
 const f=fixture();let submits=0;f.io.submit=async()=>{submits++;throw Error("network lost")};
 await assert.rejects(confirmAdjustment(source,draft,f.io),{submitted:true});assert.equal(submits,1);
});