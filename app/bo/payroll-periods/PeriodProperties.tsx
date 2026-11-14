"use client";
/** PAP-1985 native PINO DS property renderer, P0 dates-only commands. */
import {useState,useRef,useEffect,useCallback} from "react";
import {PropertySections,type CreateDrawerField} from "@/app/components/workspace-renderer/Properties";
import {DrawerFrame} from "@/app/components/workspace-renderer/DrawerFrame";
import {BoTypedEditor} from "@/app/bo/components/registration/BoTypedEditor";
import type {BoField,BoRecord,BoValue} from "@/lib/bo-registration";
import {periodApi,money,type PayPeriodDates} from "@/lib/bo-payroll-period-api";
import {validNativePeriodDates,type NativePeriodRow} from "@/lib/bo-payroll-native-period-model";
import {periodDisplayName} from "@/lib/bo-payroll-read-model";
import "@pino/design-system/bo-tokens.css";
import "@pino/design-system/components.css";

export const periodFields:BoField[]=[
 {key:"name",label:"Tên kỳ",type:"text",icon:"Aa",w:220,readonly:true},
 {key:"startDate",label:"Bắt đầu",type:"date",icon:"▦",w:145},
 {key:"endDate",label:"Kết thúc",type:"date",icon:"▦",w:145},
 ...[["status","Trạng thái"],["staffCount","PTE có công"],["expected","Tổng Dự Kiến"],["finalized","Tổng Quyết Toán"],
 ["createdAt","Created Time"],["createdBy","Created By"],["updatedAt","Last Modified Time"],["updatedBy","Last Modified By"]].map(([key,label])=>({key,label,type:"text" as const,icon:"Aa",w:145,readonly:true})),
];
const sections=[{id:"overview",label:"Thông tin chính",fields:periodFields.map(f=>f.key)}];
const dateField=(k:string):k is keyof PayPeriodDates=>k==="startDate"||k==="endDate";
function record(row:NativePeriodRow):BoRecord{
 return {id:row.id,name:row.name,startDate:row.startDate,endDate:row.endDate,
  status:row.status==="ARCHIVED"?"Lưu trữ":row.dateLocked?"Đã khóa ngày":"Đang mở",
  staffCount:row.staffCount??"—",expected:money(row.expected),finalized:money(row.finalized),
  createdAt:row.createdTime,createdBy:row.createdActor,updatedAt:row.modifiedTime,updatedBy:row.modifiedActor};
}
function text(e:unknown){return e instanceof Error?e.message:"Không thể lưu kỳ lương.";}
export function PeriodProperties({row,variant,onSaved}:{row:NativePeriodRow;variant:"drawer"|"detail";onSaved:()=>void}){
 const [edit,setEdit]=useState<{field:BoField;anchor:HTMLElement}|null>(null);
 const [error,setError]=useState(""),[busy,setBusy]=useState(false);
 const saving=useRef(false),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const close=useCallback(()=>{if(!saving.current)setEdit(null);},[]);
 const allowed=row.canEdit===true&&row.status==="ACTIVE"&&!row.dateLocked;
 async function save(value:BoValue){
  if(!edit||!allowed||saving.current||!alive.current||!dateField(edit.field.key)||typeof value!=="string")return;
  const input={startDate:row.startDate,endDate:row.endDate,[edit.field.key]:value};
  if(!validNativePeriodDates(input)){setError("Khoảng ngày không hợp lệ.");return;}
  if(input.startDate===row.startDate&&input.endDate===row.endDate){close();return;}
  saving.current=true;setBusy(true);setError("");
  try{
   const reply=(await periodApi.editDates(row.centerId,row,input)).data;
   const read=(await periodApi.get(row.centerId,row.id)).data;
   if(reply.centerId!==row.centerId||reply.id!==row.id||reply.version!==row.version+1||
    read.centerId!==row.centerId||read.id!==row.id||read.version!==reply.version||
    read.startDate!==input.startDate||read.endDate!==input.endDate)throw Error("Không xác minh được kỳ lương đã lưu. Tải lại trước khi sửa.");
   if(alive.current){setEdit(null);onSaved();}
  }catch(e){if(alive.current)setError(text(e));}
  finally{saving.current=false;if(alive.current)setBusy(false);}
 }
 return <>
  <PropertySections fields={periodFields} record={record(row)} sections={sections} variant={variant}
   canEdit={field=>allowed&&!busy&&dateField(field.key)} onEdit={(field,anchor)=>{if(allowed&&!saving.current&&dateField(field.key)){setError("");setEdit({field,anchor});}}}/>
  {edit&&allowed?<BoTypedEditor field={edit.field} value={row[edit.field.key as keyof PayPeriodDates]} anchor={edit.anchor}
   onClose={close} onSave={v=>void save(v)} closeOnSave={false}/>:null}
  {error?<p role="alert">{error}</p>:null}{busy?<p role="status">Đang lưu…</p>:null}
 </>;
}
export function CreatePeriod({centerId,centerName,onClose,onSaved,keyForPayload}:{centerId:string;centerName:string;onClose:()=>void;onSaved:()=>void;keyForPayload:(payload:string)=>string}){
 const [dates,setDates]=useState<PayPeriodDates>({startDate:"",endDate:""});
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const saving=useRef(false),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const close=useCallback(()=>{if(!saving.current)onClose();},[onClose]);
 const controls:Record<string,CreateDrawerField>=Object.fromEntries((["startDate","endDate"] as const).map(k=>[k,{
  id:"period-create-"+k,value:dates[k],onChange:(v:string)=>setDates(o=>({...o,[k]:v})),required:true,disabled:busy,
  control:<input className="property-control" id={"period-create-"+k} type="date" required value={dates[k]} disabled={busy}
   onChange={e=>{setError("");setDates(o=>({...o,[k]:e.target.value}));}}/>,
 }]));
 const draft:BoRecord={...Object.fromEntries(periodFields.map(f=>[f.key,"—"])),id:"",name:dates.startDate?periodDisplayName(dates.startDate,centerName):"—"};
 async function save(){
  if(saving.current||!alive.current)return;
  if(!validNativePeriodDates(dates)){setError("Vui lòng chọn khoảng ngày hợp lệ.");return;}
  const payload=JSON.stringify({centerId,...dates});
  const key=keyForPayload(payload);
  saving.current=true;setBusy(true);setError("");
  try{
   const receipt=(await periodApi.createDates(centerId,dates,key)).data;
   if(receipt.centerId!==centerId||!receipt.id.match(/^[0-9a-f-]{36}$/))throw Error("Phản hồi kỳ lương không đúng cơ sở.");
   const read=(await periodApi.get(centerId,receipt.id)).data;
   if(read.centerId!==centerId||read.id!==receipt.id||read.startDate!==dates.startDate||read.endDate!==dates.endDate)throw Error("Chưa xác minh được kỳ lương đã lưu.");
   if(alive.current)onSaved();
  }catch(e){if(alive.current)setError(text(e));}
  finally{saving.current=false;if(alive.current)setBusy(false);}
 }
 return <DrawerFrame title="Tạo kỳ lương" path="Kỳ lương" onClose={close}
  footer={<><button type="button" className="secondary-btn" disabled={busy} onClick={close}>Hủy</button><button type="button" className="primary-btn" disabled={busy||!validNativePeriodDates(dates)} onClick={()=>void save()}>{busy?"Đang lưu…":"Lưu"}</button></>}>
  <PropertySections fields={periodFields} record={draft} sections={sections} variant="drawer" createFields={controls}/>
  {error?<p role="alert">{error}</p>:null}
 </DrawerFrame>;
}
