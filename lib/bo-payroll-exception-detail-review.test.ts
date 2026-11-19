import test from "node:test";
import assert from "node:assert/strict";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {PayrollExceptionDetailReview} from "@/app/bo/payroll-exceptions/PayrollExceptionDetailReview";
import {payrollDecisionDisabled,type PayrollExceptionDecisionFormProps} from "@/app/bo/payroll-exceptions/PayrollExceptionDecisionForm";
import {toExceptionReadRow} from "./bo-payroll-exceptions-model";
import {canReviewStandalone,type NativeReviewedException} from "./bo-payroll-exceptions-read";

const source:NativeReviewedException={id:"qa-review",centerId:"qa-center",staffMemberId:"qa-staff",assignmentId:"qa-shift",workDate:"2026-11-19",requestedStartAt:"2026-11-19T14:00:00Z",requestedEndAt:"2026-11-19T14:30:00Z",requestReason:"Synthetic request",status:"PENDING",decision:null,reviewEligibility:{centerId:"qa-center",requestId:"qa-review",canReview:true}};
const noop=()=>{};
const props:PayrollExceptionDecisionFormProps={partial:false,from:"21:00",to:"21:30",reason:"Synthetic review reason",onPartial:noop,onFrom:noop,onTo:noop,onReason:noop,onDecision:noop};
function render(row=source,decision:PayrollExceptionDecisionFormProps=props){
 return renderToStaticMarkup(createElement(PayrollExceptionDetailReview,{row:toExceptionReadRow(row,row.centerId),decision:canReviewStandalone(row,row.centerId,row.id)?decision:undefined}));
}
test("PAP-2197 approved Detail form contains canonical review controls only for eligible pending requests",()=>{
 const html=render();
 assert.match(html,/data-pap2197-review/);
 assert.match(html,/aria-label="Lý do"/);
 assert.match(html,/aria-label="Duyệt một phần"/);
 assert.match(html,/>Duyệt<\/button>/);
 assert.match(html,/>Từ chối<\/button>/);
 assert.doesNotMatch(html,/aria-label="Từ giờ"/);
 assert.match(render(source,{...props,partial:true}),/aria-label="Từ giờ"/);
 assert.equal(render({...source,reviewEligibility:undefined}),"");
 assert.equal(render({...source,reviewEligibility:{...source.reviewEligibility!,canReview:false}}),"");
 assert.equal(render({...source,status:"WITHDRAWN"}),"");
});
test("PAP-2197 busy, uncertain and invalid reason disable both commands",()=>{
 for(const state of [{busy:true},{uncertain:true},{reason:" short "},{reason:"x".repeat(1001)}]){
  const p={...props,...state};
  assert.equal(payrollDecisionDisabled(p),true);
  const html=render(source,p);
  const buttons=html.match(/<button\b[^>]*>/g)??[];
  assert.equal(buttons.length,2);
  assert.ok(buttons.every(b=>/\bdisabled=""/.test(b)));
 }
 assert.equal(payrollDecisionDisabled(props),false);
});
