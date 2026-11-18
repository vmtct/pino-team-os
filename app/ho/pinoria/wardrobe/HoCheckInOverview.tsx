"use client";
import {useEffect,useRef,useState} from "react";
import {PropertySections,type OverviewProperties} from "@/app/components/workspace-renderer/Properties";
import {BoTypedEditor} from "@/app/bo/components/registration/BoTypedEditor";
import type {BoField,BoValue} from "@/lib/bo-registration";
import type {AuthorizationContext} from "@/lib/workspace-schema";
import {saveCheckInItem,saveItemRarity,parseItemRarityLabel} from "./item-client";
/** PAP-2073: native DSA property renderer and existing HO domain command, not generic HO mutations. */
export function HoCheckInOverview({properties,context,onSaved}:{properties:OverviewProperties;context:AuthorizationContext;onSaved:()=>void}){
 const [selection,setSelection]=useState<{field:BoField;anchor:HTMLButtonElement}|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const [labelWidth,setLabelWidth]=useState(160);const pending=useRef<AbortController|null>(null);
 useEffect(()=>()=>pending.current?.abort(),[]);
 const record=properties.record;
 const authorized=context.surface==="HO"&&context.authorize("pinoria.item.view")&&context.authorize("pinoria.item.manage")&&(record.type==="WEARABLE"||record.type==="ACCESSORY")&&typeof record.revision==="number"&&Number.isSafeInteger(record.revision)&&record.revision>0;
 const canEdit=(field:BoField)=>authorized&&!busy&&(field.key==="checkInItem"?typeof record.checkInItem==="boolean":field.key==="rarity"&&typeof record.rarity==="string"&&record.status!=="UNPUBLISHED");
 async function save(value:BoValue){if(!selection||!canEdit(selection.field)||pending.current||typeof record.revision!=="number")return;const controller=new AbortController();pending.current=controller;setBusy(true);setError("");try{if(selection.field.key==="rarity"){await saveItemRarity(record.id,record.revision,parseItemRarityLabel(value),controller.signal);}else{if(typeof value!=="boolean")throw Error("Check-in Item không hợp lệ.");await saveCheckInItem(record.id,record.revision,value,controller.signal);}if(!controller.signal.aborted){setSelection(null);onSaved();}}catch(cause){if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:"Không thể cập nhật Item.");}finally{if(!controller.signal.aborted){pending.current=null;setBusy(false)}}}
 return <><PropertySections variant="detail" fields={properties.fields} record={record} sections={properties.sections} canEdit={canEdit} onEdit={(field,anchor)=>{if(canEdit(field)){setError("");setSelection({field,anchor})}}} labelWidth={labelWidth} onLabelWidthChange={setLabelWidth}/>{busy?<p role="status">Đang lưu…</p>:null}{error?<p role="alert">{error} <button type="button" disabled={busy} onClick={()=>{setSelection(null);setError("");onSaved();}}>Tải lại</button></p>:null}{selection&&authorized?<BoTypedEditor field={{...selection.field,readonly:false}} value={(selection.field.key==="rarity"?record.rarity:record.checkInItem) as BoValue} anchor={selection.anchor} closeOnSave={false} onClose={()=>{if(!busy)setSelection(null)}} onSave={value=>{void save(value)}}/>:null}</>;
}
