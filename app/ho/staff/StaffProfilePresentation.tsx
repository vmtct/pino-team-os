"use client";
import {useRef,useState} from "react";
import {PropertySections,type PropertyField,type PropertyValue,type PropertyCommitResult} from "@pino/design-system/react";
import type {OverviewProperties} from "@/app/components/workspace-renderer/Properties";
import {staffProfileKeys} from "./staff-profile-local";
import type {StaffActivationFixture} from "./staff-activation-preview";
type Props={properties:OverviewProperties;record:StaffActivationFixture;persist:(revision:number,key:string,value:PropertyValue)=>StaffActivationFixture|null;onSaved:()=>void;stop:(revision:number,confirmed:boolean)=>StaffActivationFixture|null};
export function StaffProfilePresentation({properties,record,persist,onSaved,stop}:Props){
 const [current,setCurrent]=useState(record);const [review,setReview]=useState<number|null>(null),[error,setError]=useState(false);
 const live=useRef(current);const allowed=(key:string)=>staffProfileKeys.some(k=>k===key);
 const fields:PropertyField[]=properties.fields.filter(f=>properties.sections.some(s=>s.fields.includes(f.key))).map(f=>{
  const base={key:f.key,label:f.label,icon:f.icon,readOnly:!allowed(f.key),required:["name","phone","email"].includes(f.key)};
  if(f.key==="gender")return {...base,type:"select",options:[{value:"Nam",label:"Nam"},{value:"Nữ",label:"Nữ"},{value:"Khác",label:"Khác"}]};
  return {...base,type:f.key==="birthDate"?"date":f.key==="email"?"email":"text"};
 });
 const values=Object.fromEntries(fields.map(f=>[f.key,current[f.key as keyof StaffActivationFixture] as PropertyValue]));
 async function commit(key:string,value:PropertyValue,{signal}:{signal:AbortSignal}):Promise<PropertyCommitResult>{
  if(signal.aborted||!allowed(key))return {status:"denied"};
  const next=persist(live.current.activationRevision,key,value);
  if(!next)return {status:"conflict"};
  live.current=next;setCurrent(next);
  return {status:"saved",value:next[key as keyof StaffActivationFixture] as PropertyValue};
 }
 return <div data-staff-profile-local><PropertySections recordKey={record.id} fields={fields} values={values} sections={properties.sections} variant="detail" surface="ho" canEdit={allowed} onCommit={commit} onSaved={onSaved}/><p>Trạng thái làm việc dùng thao tác vòng đời; cơ sở và quyền truy cập quản lý trong Access.</p>{current.status==="Đang làm"&&<section className="v24-prop-section" data-staff-employment-stop><h3>{"Trạng thái làm việc"}</h3>{review===null?<button type="button" className="secondary-btn" onClick={()=>{setError(false);setReview(live.current.activationRevision);}}>{"Ngừng làm việc"}</button>:<div role="group" aria-label="Xac nhan ngung lam viec"><p>{"Ngừng làm việc: "}{current.name}?</p><p>{"Chỉ thay đổi trạng thái hồ sơ mẫu. Tài khoản, vai trò và cơ sở giữ nguyên."}</p><button type="button" className="secondary-btn" onClick={()=>setReview(null)}>{"Hủy"}</button> <button type="button" className="primary-btn" disabled={review!==current.activationRevision} onClick={()=>{const next=stop(review,true);if(!next){setError(true);return;}live.current=next;setCurrent(next);setReview(null);onSaved();}}>{"Xác nhận ngừng"}</button></div>}{error&&<p role="alert">{"Hồ sơ đã thay đổi; vui lòng mở lại."}</p>}</section>}</div>;
}
