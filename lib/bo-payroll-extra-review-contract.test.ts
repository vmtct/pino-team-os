import test from "node:test";
import assert from "node:assert/strict";
import { decisionPayload,localClock,reviewedAmount,type ReviewedException }
 from "./bo-payroll-extra-review-api";
import { isBoPayrollReviewPath } from "./bo-payroll-extra-review-handler";

const row:ReviewedException={
 id:"1cddf9e6-2ef4-42b2-8d50-74dcab97c9f8",
 centerId:"a57d77f0-d217-4af6-afb9-fc41b6751209",staffMemberId:"staff-a",
 assignmentId:"assignment-a",workDate:"2026-10-20",
 requestedStartAt:"2026-10-20T11:05:00.000Z",
 requestedEndAt:"2026-10-20T11:15:00.000Z",
 requestReason:"Setup room for open shift",status:"PENDING",decision:null,
};
test("PAP-803 BO routes only review collection, detail, and decision",()=>{
 assert.equal(isBoPayrollReviewPath("workforce/payroll/extra-time/reviews"),true);
 assert.equal(isBoPayrollReviewPath("workforce/payroll/extra-time/reviews/"+row.id),true);
 assert.equal(isBoPayrollReviewPath("workforce/payroll/extra-time/reviews/"+row.id+"/decision"),true);
 assert.equal(isBoPayrollReviewPath("workforce/payroll/extra-time/reviews/"+row.id+"/delete"),false);
 assert.equal(isBoPayrollReviewPath("workforce/payroll/extra-time"),false);
});
test("PAP-803 full approval retains precise Core-requested UTC interval",()=>{
 assert.deepEqual(decisionPayload(row,"FULL","","","Confirmed extra preparation"),{
  centerId:row.centerId,requestId:row.id,decision:"APPROVED",
  approvedStartAt:row.requestedStartAt,
  approvedEndAt:row.requestedEndAt,reason:"Confirmed extra preparation",
 });
});
test("PAP-803 partial approval uses Vietnam local offset with minute precision",()=>{
 assert.deepEqual(decisionPayload(row,"PARTIAL","18:06","18:12","Confirmed partial preparation"),{
  centerId:row.centerId,requestId:row.id,decision:"APPROVED",
  approvedStartAt:"2026-10-20T18:06:00+07:00",approvedEndAt:"2026-10-20T18:12:00+07:00",
  reason:"Confirmed partial preparation",
 });
 assert.throws(()=>decisionPayload(row,"PARTIAL","18:00","18:12","Confirmed partial preparation"));
 assert.throws(()=>decisionPayload(row,"PARTIAL","18:11","18:20","Confirmed partial preparation"));
 assert.throws(()=>decisionPayload(row,"PARTIAL","18:12","18:06","Confirmed partial preparation"));
});
test("PAP-803 rejection cannot carry approved financial interval",()=>{
 assert.deepEqual(decisionPayload(row,"REJECTED","18:05","18:15","Rejected due to no supporting evidence"),{
  centerId:row.centerId,requestId:row.id,decision:"REJECTED",
  reason:"Rejected due to no supporting evidence",
 });
 assert.throws(()=>decisionPayload(row,"REJECTED","","","Too short"));
});
test("PAP-803 staff/BO text formats record only, no calculated money",()=>{
 assert.equal(localClock(row.requestedStartAt),"18:05");
 assert.equal(reviewedAmount(2500),"2.500 ₫");
 assert.equal(reviewedAmount(null),"Chưa chốt");
});
