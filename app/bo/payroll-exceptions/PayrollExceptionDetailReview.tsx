"use client";
/** PAP-2197 Founder correction: decision only in Full Detail, never in Drawer. */
import {BoActionButton,BoActionGroup} from "@pino/design-system/react";
import {PayrollExceptionDecisionForm,payrollDecisionDisabled,type PayrollExceptionDecisionFormProps} from "./PayrollExceptionDecisionForm";
import type {ExceptionReadRow} from "@/lib/bo-payroll-exceptions-model";

export function PayrollExceptionDetailReview({row,decision,feedback}:{
 row:ExceptionReadRow;decision?:PayrollExceptionDecisionFormProps;feedback?:{kind:"status"|"alert";message:string};
}){
 const active=row.status==="PENDING"&&row.source.decision===null?decision:undefined;
 if(!active&&!feedback)return null;
 return <section data-pap2197-review="" className="v24-prop-section">
  {active?<><PayrollExceptionDecisionForm {...active} hideActions/>
   <BoActionGroup data-tdd-action-region="detail.section">
    <BoActionButton variant="secondary" type="button" disabled={payrollDecisionDisabled(active)} onClick={()=>active.onDecision("REJECTED")}>Từ chối</BoActionButton>
    <BoActionButton variant="primary" type="button" disabled={payrollDecisionDisabled(active)} onClick={()=>active.onDecision(active.partial?"PARTIAL":"FULL")}>Duyệt</BoActionButton>
   </BoActionGroup></>:null}
  {feedback?<p role={feedback.kind}>{feedback.message}</p>:null}
 </section>;
}
