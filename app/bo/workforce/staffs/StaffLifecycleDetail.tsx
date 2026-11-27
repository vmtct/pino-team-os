"use client";
import {useRef,useState} from "react";
import {BoProperties} from "@/app/bo/components/BoProperties";
import {BoTypedCellEditor} from "@/app/bo/components/data-grid";
import {useStaffRegistrationConfirmation} from "@/app/bo/staff/StaffRegistrationConfirmation";
import styles from "@/app/bo/bo.module.css";
import type {StaffLifecycleM1Fixture,StaffLifecycleSnapshot,StaffOperationalProfileField} from "./staff-lifecycle-m1-fixture";
const editableFields:{key:StaffOperationalProfileField;label:string}[]=[
 {key:"displayLabel",label:"H\u1ecd v\u00e0 t\u00ean"},
 {key:"department",label:"B\u1ed9 ph\u1eadn"},
 {key:"employmentType",label:"Lo\u1ea1i nh\u00e2n s\u1ef1"},
 {key:"startDate",label:"Ng\u00e0y b\u1eaft \u0111\u1ea7u (YYYY-MM-DD)"}
];
/** Feature-owned native Staff properties; only an isolated M1 adapter can be supplied here. */
export function StaffLifecycleDetail({fixture,recordId,centerName,onSaved}:{fixture:StaffLifecycleM1Fixture;recordId:string;centerName:string;onSaved:(next:StaffLifecycleSnapshot)=>void}){
 const [snapshot,setSnapshot]=useState(()=>fixture.snapshot());
 const [field,setField]=useState<StaffOperationalProfileField|null>(null);
 const [draft,setDraft]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const lock=useRef(false);
 const confirm=useStaffRegistrationConfirmation();
 const profile=snapshot.profile;
 if(!profile||profile.id!==recordId)return <p role="status">{"Kh\u00f4ng t\u00ecm th\u1ea5y h\u1ed3 s\u01a1 nh\u00e2n s\u1ef1."}</p>;
 const publish=(next:StaffLifecycleSnapshot)=>{setSnapshot(next);onSaved(next);};
 const begin=(key:StaffOperationalProfileField)=>{if(busy)return;setError("");setDraft(profile[key]??"");setField(key);};
 const save=()=>{if(!field||lock.current)return;lock.current=true;setBusy(true);setError("");try{
  const value=draft.trim();
  if(field==="displayLabel"&&!value)throw Error("H\u1ecd v\u00e0 t\u00ean kh\u00f4ng \u0111\u01b0\u1ee3c \u0111\u1ec3 tr\u1ed1ng.");
  const next=fixture.edit(recordId,snapshot.revision,{[field]:value||null});publish(next);setField(null);
 }catch(cause){setError(cause instanceof Error?cause.message:"Kh\u00f4ng th\u1ec3 l\u01b0u.");}finally{lock.current=false;setBusy(false);}};
 const deactivate=async()=>{if(lock.current||field||profile.status!=="active")return;lock.current=true;setBusy(true);setError("");try{
  if(!await confirm.ask("Ng\u01b0ng ho\u1ea1t \u0111\u1ed9ng nh\u00e2n s\u1ef1 n\u00e0y? T\u00e0i kho\u1ea3n v\u00e0 quy\u1ec1n truy c\u1eadp do HO qu\u1ea3n l\u00fd."))return;
  publish(fixture.deactivate(recordId,snapshot.revision,true));
 }catch(cause){setError(cause instanceof Error?cause.message:"Kh\u00f4ng th\u1ec3 ng\u01b0ng ho\u1ea1t \u0111\u1ed9ng.");}finally{lock.current=false;setBusy(false);}};
 const items=editableFields.map(({key,label})=>({key,label,value:field===key?<BoTypedCellEditor label={label} value={draft} saving={busy} error={error} onChange={setDraft} onCommit={save} onCancel={()=>{setField(null);setError("");}}/>:<button type="button" className={styles.secondaryButton} aria-label={"S\u1eeda "+label} disabled={busy||field!==null||profile.status!=="active"} onClick={()=>begin(key)}>{profile[key]??"\u2014"}</button>}));
 return <section className="v24-prop-section"><div className="v24-section-heading"><h4>{"Th\u00f4ng tin ch\u00ednh"}</h4></div><BoProperties authority items={[...items,{key:"email",label:"Email",value:profile.email??"\u2014"},{key:"mobile",label:"\u0110i\u1ec7n tho\u1ea1i",value:profile.mobile??"\u2014"},{key:"center",label:"C\u01a1 s\u1edf",value:centerName},{key:"role",label:"Vai tr\u00f2",value:profile.roleLabel??"\u2014"},{key:"status",label:"Tr\u1ea1ng th\u00e1i l\u00e0m vi\u1ec7c",value:profile.status==="active"?"\u0110ang l\u00e0m":"Ng\u01b0ng ho\u1ea1t \u0111\u1ed9ng"},{key:"account",label:"T\u00e0i kho\u1ea3n",value:"Ch\u01b0a x\u00e1c minh"},{key:"readiness",label:"\u0110i\u1ec1u ki\u1ec7n v\u1eadn h\u00e0nh",value:snapshot.operationalReadiness==="NOT_READY"?"Ch\u01b0a \u0111\u1ee7 \u0111i\u1ec1u ki\u1ec7n":"Ch\u01b0a x\u00e1c minh"}]}/>
 <p className={styles.registrationPrivacyNote}>{"HO qu\u1ea3n l\u00fd danh t\u00ednh, t\u00e0i kho\u1ea3n v\u00e0 vai tr\u00f2. Tr\u1ea1ng th\u00e1i l\u00e0m vi\u1ec7c kh\u00f4ng t\u1ef1 c\u1ea5p quy\u1ec1n v\u1eadn h\u00e0nh."}</p>
 {field===null&&error?<p role="alert">{error}</p>:null}
 {profile.status==="active"?<button type="button" className={styles.secondaryButton} disabled={busy||field!==null} onClick={()=>void deactivate()}>{"Ng\u01b0ng ho\u1ea1t \u0111\u1ed9ng"}</button>:null}{confirm.dialog}</section>;
}
