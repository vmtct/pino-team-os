"use client";
import { useEffect, useRef, useState } from "react";
import { styles } from "./lead-household-styles";
export type InlineKey = "name" | "phone" | "program" | "path";
export function InlineProperty({label,value,field,onSave,options}: {label:string;value:string;field:InlineKey;onSave:(field:InlineKey,value:string)=>string|null;options?:string[]}) {
 const [active,setActive]=useState(false),[draft,setDraft]=useState(value),[error,setError]=useState("");
 const input=useRef<HTMLInputElement|HTMLSelectElement>(null);
 useEffect(()=>{if(!active)setDraft(value);},[value,active]);
 useEffect(()=>{if(active)input.current?.focus();},[active]);
 const cancel=()=>{setDraft(value);setError("");setActive(false);};
 const save=()=>{const result=onSave(field,draft.trim());if(result){setError(result);return;}setError("");setActive(false);};
 return <div className={styles.field}><span>{label}</span>{active?<div className={styles.propertyEditor}>
 {options?<select ref={input as React.Ref<HTMLSelectElement>} aria-label={label} value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();save();}if(e.key==="Escape"){e.preventDefault();cancel();}}}>{options.map(o=><option key={o}>{o}</option>)}</select>:<input ref={input as React.Ref<HTMLInputElement>} aria-label={label} value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();save();}if(e.key==="Escape"){e.preventDefault();cancel();}}}/>}
 <button type="button" className={styles.propertyConfirm} onClick={save} aria-label={"Lưu "+label}>✓</button><button type="button" className={styles.propertyCancel} onClick={cancel} aria-label={"Hủy "+label}>×</button>{error&&<small className={styles.propertyError} role="alert">{error}</small>}</div>:<button type="button" className={styles.propertyEdit} onClick={()=>{setDraft(value);setError("");setActive(true);}} aria-label={"Chỉnh sửa "+label}><strong>{value||"—"}</strong><span className={styles.propertyPencil} aria-hidden="true">✎</span></button>}</div>;
}
