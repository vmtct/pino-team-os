"use client";
// PAP-2347: explicit isolated M1 sample, never a native form submission or live provider.
import {useEffect,useMemo,useRef,useState,Suspense} from "react";
import {TosButton} from "@pino/design-system/react";
import {BusinessDataGrid,validateBusinessFormData,validateBusinessFormSubmitResult,type BusinessFormData,type BusinessFormRequest,type BusinessFormValue} from "@/app/components/workspace-renderer/Slots";
import type {AuthorizationContext} from "@/lib/workspace-schema";
import {LOCAL_STAFF_RATE_PRINCIPAL,verifyLocalRateReadback,type createLocalStaffRateAction} from "./staff-rate-local-action";
type Authorized=Extract<BusinessFormData,{status:"authorized"}>;
const fields=["amount","effectiveDate","reason"] as const;
export function StaffRateSample({recordId,context,action}:{recordId:string;context:AuthorizationContext;action:ReturnType<typeof createLocalStaffRateAction>}){
 const request=useMemo<BusinessFormRequest>(()=>({surface:"HO",moduleKey:"staffs",slotId:"staff-rate",sourceAdapter:"salary.staff-rate",recordId,subject:{type:"staffs",id:recordId},principalId:LOCAL_STAFF_RATE_PRINCIPAL,context}),[recordId,context]);
 const [data,setData]=useState<Authorized|null>(null),[values,setValues]=useState<Readonly<Record<string,BusinessFormValue>>>({}),[notice,setNotice]=useState(""),[phase,setPhase]=useState<"loading"|"idle"|"pending"|"unknown"|"denied">("loading");
 const lock=useRef(false),controller=useRef<AbortController|null>(null);
 useEffect(()=>{const c=new AbortController();controller.current=c;void action.read(request,c.signal).then(raw=>{if(c.signal.aborted)return;const next=validateBusinessFormData(raw,fields);if(next.status==="authorized"){setData(next);setValues(next.values);setPhase("idle");}else setPhase("denied");}).catch(()=>{if(!c.signal.aborted)setPhase("unknown");});return()=>{c.abort();controller.current=null;};},[action,request]);
 async function apply(){
  if(lock.current||phase!=="idle"||!data||!context.authorize("staff.compensation.manage"))return;
  const signal=controller.current?.signal;if(!signal||signal.aborted)return;
  lock.current=true;setPhase("pending");setNotice("");
  try{const result=validateBusinessFormSubmitResult(await action.applySample(request,values,signal),data.fields);if(signal.aborted)return;
   if(result.status!=="saved"){setPhase(result.status==="denied"?"denied":"idle");setNotice(result.status==="invalid"?"Dữ liệu mẫu chưa hợp lệ.":"Không có quyền thực hiện.");return;}
   const next=validateBusinessFormData(await action.read(request,signal),fields);if(signal.aborted)return;
   if(next.status!=="authorized"||!verifyLocalRateReadback(data,next,values)){setPhase("unknown");return;}
   setData(next);setValues(next.values);setPhase("idle");setNotice("Đã xác minh mức lương mẫu.");
  }catch{if(!signal.aborted)setPhase("unknown");}finally{lock.current=false;}
 }
 if(phase==="denied")return <p role="status">Không có quyền xem dữ liệu mẫu.</p>;
 if(!data)return <p role="status">{phase==="unknown"?"Không xác minh được dữ liệu mẫu.":"Đang tải dữ liệu mẫu."}</p>;
 const records=data.records,disabled=phase!=="idle"||!context.authorize("staff.compensation.manage");
 return <div className="pds-business-compact-workspace" data-tdd-business-slot="staff-rate"><section className="v24-prop-section pds-business-compact-form" aria-label="Mức lương mẫu"><h3>Mức lương mới (M1)</h3><p>Chỉ thử dữ liệu mẫu trong bộ nhớ; không lưu lương thực tế.</p>{data.fields.map(field=><label className="property-row" key={field.key}><span>{field.label}{field.required?" *":""}</span>{field.type==="textarea"?<textarea disabled={disabled} value={String(values[field.key]??"")} onChange={e=>setValues(v=>({...v,[field.key]:e.target.value}))}/>:<input disabled={disabled} type={field.type} value={values[field.key]??""} onChange={e=>setValues(v=>({...v,[field.key]:field.type==="number"?(e.target.value===""?null:Number(e.target.value)):e.target.value}))}/>}</label>)}<TosButton type="button" disabled={disabled||data.fields.some(f=>f.required&&(values[f.key]===null||values[f.key]===""))} onClick={()=>void apply()}>{phase==="pending"?"Đang kiểm tra...":"Thử mức lương mẫu"}</TosButton>{notice&&<p role="status">{notice}</p>}{phase==="unknown"&&<p role="alert">Chưa xác minh được kết quả. Không gửi lại thao tác.</p>}</section>{records&&<section className="v24-prop-section"><h3>{records.label}</h3><Suspense fallback={<p role="status">Đang tải lịch sử mẫu.</p>}><BusinessDataGrid<NonNullable<Authorized["records"]>["rows"][number]> rows={records.rows} columns={records.columns.map(c=>({key:c.key,header:c.label,render:row=>String(row.values[c.key]??"-")}))} rowKey={row=>row.id} caption={records.label} showToolbar={false} emptyTitle="Chưa có bản ghi" emptyMessage="Chưa có lịch sử mức lương mẫu."/></Suspense></section>}</div>;
}
