// PAP-2347 / WFM-STAFF: offline presentation action, separate from native form submission.
// This is not an authorization boundary for any live route.
import type {BusinessFormData,BusinessFormRequest,BusinessFormValue} from "@/app/components/workspace-renderer/Slots";
import {activationRateProvider} from "./staff-activation-baseline-preview";
export const LOCAL_STAFF_RATE_PRINCIPAL="synthetic-presentation-only";
export function createLocalStaffRateAction(exists:(id:string)=>boolean){
 const fixture=activationRateProvider(LOCAL_STAFF_RATE_PRINCIPAL,exists);
 const admitted=(r:BusinessFormRequest)=>r.surface==="HO"&&r.context.surface==="HO"&&r.moduleKey==="staffs"&&r.slotId==="staff-rate"&&r.sourceAdapter==="salary.staff-rate"&&r.subject.type==="staffs"&&r.subject.id===r.recordId&&r.principalId===LOCAL_STAFF_RATE_PRINCIPAL&&/^STAFF-MOCK-\d{3,}$/.test(r.recordId)&&exists(r.recordId)&&r.context.authorize("team.bo.access");
 return {
  async read(r:BusinessFormRequest,signal:AbortSignal){signal.throwIfAborted();return admitted(r)?fixture.load(r,signal):{status:"denied" as const};},
  async applySample(r:BusinessFormRequest,values:Readonly<Record<string,BusinessFormValue>>,signal:AbortSignal){signal.throwIfAborted();if(!admitted(r)||!r.context.authorize("staff.compensation.manage"))return {status:"denied" as const};return fixture.submit(r,values,signal);}
 };
}
// PAP-2347: verify exact sample receipt, not just an incremented row count.
export function verifyLocalRateReadback(before:BusinessFormData,after:BusinessFormData,values:Readonly<Record<string,BusinessFormValue>>):boolean{
 if(before.status!=="authorized"||after.status!=="authorized"||!before.records||!after.records)return false;
 const old=before.records.rows,next=after.records.rows;
 if(typeof values.amount!=="number"||typeof values.effectiveDate!=="string"||typeof values.reason!=="string"||next.length!==old.length+1)return false;
 const ids=new Set(old.map(row=>row.id));if(ids.size!==old.length||new Set(next.map(row=>row.id)).size!==next.length)return false;
 const added=next.filter(row=>!ids.has(row.id));if(added.length!==1)return false;
 const expectedDate=values.effectiveDate.split("-").reverse().join("/");
 const expectedAmount=new Intl.NumberFormat("vi-VN").format(values.amount)+" đ/giờ";
 if(added[0]?.values.effectiveFrom!==expectedDate||added[0].values.amount!==expectedAmount||added[0].values.reason!==values.reason.trim())return false;
 if(!old.every(row=>next.some(n=>n.id===row.id&&n.values.effectiveFrom===row.values.effectiveFrom&&n.values.amount===row.values.amount&&n.values.reason===row.values.reason)))return false;
 const iso=(v:unknown)=>typeof v==="string"?v.split("/").reverse().join("-"):"";
 return next.every((row,i)=>{const date=iso(row.values.effectiveFrom);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)return false;if(i===0)return row.values.effectiveUntil==="\u2014";const previous=iso(next[i-1]?.values.effectiveFrom);return previous>date&&row.values.effectiveUntil===new Date(Date.parse(previous)-86400000).toISOString().slice(0,10).split("-").reverse().join("/");});
}
