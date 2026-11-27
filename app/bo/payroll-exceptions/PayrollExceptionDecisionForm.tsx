"use client";
import {PropertySections,type CreateDrawerField} from "@/app/components/workspace-renderer/Properties";
import type {BoField} from "@/lib/bo-registration";
/** PAP-2128 native UI contract. Actions are supplied by the caller; no API or authority here. */
export type PayrollExceptionDecisionMode="FULL"|"PARTIAL"|"REJECTED";
export type PayrollExceptionDecisionFormProps={
 partial:boolean;from:string;to:string;reason:string;busy?:boolean;uncertain?:boolean;
 onPartial:(v:boolean)=>void;onFrom:(v:string)=>void;onTo:(v:string)=>void;onReason:(v:string)=>void;
 onDecision:(mode:PayrollExceptionDecisionMode)=>void; hideActions?:boolean;
};
export function payrollDecisionDisabled(p:Pick<PayrollExceptionDecisionFormProps,"busy"|"uncertain"|"reason">){return Boolean(p.busy||p.uncertain||p.reason.trim().length<10||p.reason.trim().length>1000);}
/** PAP-2197: standard one-column DSA decision fields inside Full Detail. */
function NativeDecisionFields(p:PayrollExceptionDecisionFormProps){
 const fields:BoField[]=[
  {key:"partial",label:"Duyệt một phần",type:"text",icon:"◉",w:140},
  ...(p.partial?[
   {key:"from",label:"Từ giờ",type:"text",icon:"◷",w:140},
   {key:"to",label:"Đến giờ",type:"text",icon:"◷",w:140}
  ] as BoField[]:[]),
  {key:"reason",label:"Lý do",type:"text",icon:"Aa",w:160}
 ];
 const disabled=Boolean(p.busy||p.uncertain);
 const createFields:Record<string,CreateDrawerField>={
  partial:{id:"pay-review-partial",value:String(p.partial),onChange:()=>{},control:<input id="pay-review-partial" aria-label="Duyệt một phần" type="checkbox" checked={p.partial} disabled={disabled} onChange={e=>p.onPartial(e.target.checked)}/>},
  from:{id:"pay-review-from",value:p.from,onChange:p.onFrom,control:<input className="edit-input" id="pay-review-from" aria-label="Từ giờ" type="time" value={p.from} disabled={disabled} onChange={e=>p.onFrom(e.target.value)}/>},
  to:{id:"pay-review-to",value:p.to,onChange:p.onTo,control:<input className="edit-input" id="pay-review-to" aria-label="Đến giờ" type="time" value={p.to} disabled={disabled} onChange={e=>p.onTo(e.target.value)}/>},
  reason:{id:"pay-review-reason",value:p.reason,onChange:p.onReason,control:<textarea className="edit-input" id="pay-review-reason" aria-label="Lý do" rows={3} value={p.reason} minLength={10} maxLength={1000} required disabled={disabled} onChange={e=>p.onReason(e.target.value)}/>}
 };
 return <PropertySections variant="drawer" fields={fields} record={{id:"",name:""}} sections={[{id:"review",label:"Duyệt ngoại lệ",fields:fields.map(f=>f.key)}]} createFields={createFields}/>;
}
export function PayrollExceptionDecisionForm(p:PayrollExceptionDecisionFormProps){
 if(p.hideActions)return <NativeDecisionFields {...p}/>;
 const disabled=payrollDecisionDisabled(p);
 return <section className="property-section" aria-label={"Duy\u1ec7t ngo\u1ea1i l\u1ec7"}>
 <h3>{"Duy\u1ec7t ngo\u1ea1i l\u1ec7"}</h3>
 <label><input type="checkbox" checked={p.partial} disabled={p.busy} onChange={e=>p.onPartial(e.target.checked)}/>{" Duy\u1ec7t m\u1ed9t ph\u1ea7n"}</label>
 {p.partial?<div className="property-row"><label>{"T\u1eeb gi\u1edd"}<input type="time" value={p.from} disabled={p.busy} onChange={e=>p.onFrom(e.target.value)}/></label><label>{"\u0110\u1ebfn gi\u1edd"}<input type="time" value={p.to} disabled={p.busy} onChange={e=>p.onTo(e.target.value)}/></label></div>:null}
 <label>{"L\u00fd do"}<textarea value={p.reason} minLength={10} maxLength={1000} required disabled={p.busy} onChange={e=>p.onReason(e.target.value)}/></label>
 {!p.hideActions?<div className="editor-actions"><button type="button" className="secondary-btn" disabled={disabled} onClick={()=>p.onDecision("REJECTED")}>{"T\u1eeb ch\u1ed1i"}</button><button type="button" className="primary-btn" disabled={disabled} onClick={()=>p.onDecision(p.partial?"PARTIAL":"FULL")}>{"Duy\u1ec7t"}</button></div>:null}
 </section>;
}
