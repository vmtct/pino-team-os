"use client";
/** PAP-2128 native UI contract. Actions are supplied by the caller; no API or authority here. */
type Mode="FULL"|"PARTIAL"|"REJECTED";
export type PayrollExceptionDecisionFormProps={
 partial:boolean;from:string;to:string;reason:string;busy?:boolean;uncertain?:boolean;
 onPartial:(v:boolean)=>void;onFrom:(v:string)=>void;onTo:(v:string)=>void;onReason:(v:string)=>void;
 onDecision:(mode:Mode)=>void;
};
export function PayrollExceptionDecisionForm(p:PayrollExceptionDecisionFormProps){
 const disabled=p.busy||p.uncertain||p.reason.trim().length<10||p.reason.trim().length>1000;
 return <section className="property-section" aria-label={"Duy\u1ec7t ngo\u1ea1i l\u1ec7"}>
 <h3>{"Duy\u1ec7t ngo\u1ea1i l\u1ec7"}</h3>
 <label><input type="checkbox" checked={p.partial} disabled={p.busy} onChange={e=>p.onPartial(e.target.checked)}/>{" Duy\u1ec7t m\u1ed9t ph\u1ea7n"}</label>
 {p.partial?<div className="property-row"><label>{"T\u1eeb gi\u1edd"}<input type="time" value={p.from} disabled={p.busy} onChange={e=>p.onFrom(e.target.value)}/></label><label>{"\u0110\u1ebfn gi\u1edd"}<input type="time" value={p.to} disabled={p.busy} onChange={e=>p.onTo(e.target.value)}/></label></div>:null}
 <label>{"L\u00fd do"}<textarea value={p.reason} minLength={10} maxLength={1000} required disabled={p.busy} onChange={e=>p.onReason(e.target.value)}/></label>
 <div className="editor-actions"><button type="button" className="secondary-btn" disabled={disabled} onClick={()=>p.onDecision("REJECTED")}>{"T\u1eeb ch\u1ed1i"}</button><button type="button" className="primary-btn" disabled={disabled} onClick={()=>p.onDecision(p.partial?"PARTIAL":"FULL")}>{"Duy\u1ec7t"}</button></div>
 </section>;
}
