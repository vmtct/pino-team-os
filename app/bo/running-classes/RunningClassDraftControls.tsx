"use client";
/** PLT-DELIVERY / PAP-1043 / PAP-2225 — shared native renderer controls.
 * Command callbacks are injected by the owning workspace; no live API or storage here.
 */
import {useRef,useState,type ReactNode} from "react";
import {BoQuickView} from "../components/registration/BoQuickView";
import {PropertySections,type CreateDrawerField} from "@/app/components/workspace-renderer/Properties";
import type {BoModule} from "@/lib/bo-registration";
import {CLASS_TOPOLOGIES,initialClassDraft,changeClassCenter,eligibleClassSpaces,validateClassDraft,type ClassCatalog,type ClassDraft,type ClassCreate,type ClassTopology} from "./running-class-draft";
import {CLASS_EDIT_KEYS,CLASS_STATUSES,type ClassEditKey,classPropertyFields,projectClassProperties,validateClassEdit,type ClassRecord,type ClassEditCommand} from "./running-class-presentation";

const weekdays=["Thứ hai","Thứ ba","Thứ tư","Thứ năm","Thứ sáu","Thứ bảy","Chủ nhật"];
const topologyLabel:Record<ClassTopology,string>={FIXED_COHORT:"Fixed cohort",FLEXIBLE_STUDIO:"Flexible studio",OVERLAPPING_COHORT:"Overlapping cohort"};
const active=(item:{status:string})=>item.status.toUpperCase()==="ACTIVE";
const controlClass="pds-direct-field";
type Update=<K extends keyof ClassDraft>(key:K,value:ClassDraft[K])=>void;
function classControls(draft:ClassDraft,catalog:ClassCatalog,update:Update,disabled=false):Record<keyof ClassDraft,ReactNode>{
  const input=(key:"operationalName"|"windowStartsLocal"|"windowEndsLocal",label:string,type:"text"|"time")=>
    <input id={"rc-"+key} aria-label={label} className={controlClass} data-pino-ds="bo" data-pds-appearance="underline" type={type} maxLength={type==="text"?200:undefined}
      required disabled={disabled} value={draft[key]} onChange={e=>update(key,e.target.value)} />;
  const num=(key:"optimalConcurrentCapacity"|"hardConcurrentCapacity"|"defaultParticipationMinutes",label:string,required=false)=>
    <input id={"rc-"+key} aria-label={label} className={controlClass} data-pino-ds="bo" data-pds-appearance="underline" type="number" min={1} step={1}
      required={required} disabled={disabled} value={draft[key]??""} onChange={e=>update(key,e.target.value===""?null:Number(e.target.value))}/>;
  const select=(key:"centerId"|"pathProgramId"|"learningSpaceId",label:string,rows:readonly {id:string;displayName:string}[])=>
    <select id={"rc-"+key} aria-label={label} className={controlClass} data-pino-ds="bo" data-pds-appearance="underline" required disabled={disabled} value={draft[key]} onChange={e=>update(key,e.target.value)}>
      <option value="">Chọn {label}</option>{rows.map(r=><option key={r.id} value={r.id}>{r.displayName}</option>)}</select>;
  return {
    operationalName:input("operationalName","Tên lớp","text"),
    centerId:select("centerId","Cơ sở",catalog.centers.filter(active)),
    pathProgramId:select("pathProgramId","Path",catalog.paths.filter(active)),
    learningSpaceId:select("learningSpaceId","Không gian học",eligibleClassSpaces(catalog,draft.centerId)),
    weekdayIso:<select id="rc-weekdayIso" aria-label="Thứ" className={controlClass} data-pino-ds="bo" data-pds-appearance="underline" disabled={disabled} value={draft.weekdayIso} onChange={e=>update("weekdayIso",Number(e.target.value))}>{weekdays.map((day,i)=><option key={day} value={i+1}>{day}</option>)}</select>,
    windowStartsLocal:input("windowStartsLocal","Giờ bắt đầu","time"),
    windowEndsLocal:input("windowEndsLocal","Giờ kết thúc","time"),
    deliveryTopology:<select id="rc-deliveryTopology" aria-label="Mô hình" className={controlClass} data-pino-ds="bo" data-pds-appearance="underline" disabled={disabled} value={draft.deliveryTopology} onChange={e=>update("deliveryTopology",e.target.value as ClassTopology)}>{CLASS_TOPOLOGIES.map(t=><option key={t} value={t}>{topologyLabel[t]}</option>)}</select>,
    optimalConcurrentCapacity:num("optimalConcurrentCapacity","Sức chứa tối ưu",true),
    hardConcurrentCapacity:num("hardConcurrentCapacity","Sức chứa tối đa"),
    defaultParticipationMinutes:num("defaultParticipationMinutes","Thời lượng tham gia (phút)",draft.deliveryTopology==="FLEXIBLE_STUDIO")
  };
}
const creationFields=classPropertyFields.filter(f=>!["id","version","createdAt","createdBy","updatedAt","updatedBy"].includes(f.key));
export function RunningClassCreateDrawer({catalog,selectedCenterId,onClose,onCreate}:{
  catalog:ClassCatalog;selectedCenterId:string;onClose:()=>void;onCreate:(command:ClassCreate)=>void;
}){
  const [draft,setDraft]=useState(()=>initialClassDraft(selectedCenterId));
  const [error,setError]=useState("");
  const update:Update=(key,value)=>{setDraft(d=>key==="centerId"?changeClassCenter(d,String(value)):{...d,[key]:value});setError("");};
  const controls=classControls(draft,catalog,update);
  const fields:Record<string,CreateDrawerField>={};
  for(const field of creationFields)if(Object.hasOwn(controls,field.key)){
    fields[field.key]={id:"rc-"+field.key,value:"",onChange:()=>{},control:controls[field.key as keyof ClassDraft]};
  }
  const classModule:BoModule={label:"Running Class",group:"SCHOOL",fields:creationFields};
  return <BoQuickView module={classModule} moduleKey="classes" record={null} onClose={onClose} create={{
    draft:{...draft,id:"",name:draft.operationalName,status:"INACTIVE"},fields:creationFields,editable:()=>false,createFields:fields,
    onChange:()=>{},error,title:"Tạo Running Class",path:"School / Running Class",
    onCreate:()=>{const result=validateClassDraft(draft,catalog);if(!result.ok){setError(Object.values(result.errors).join(" "));return;}try{onCreate(result.value);}catch(cause){setError(cause instanceof Error?cause.message:"Không thể tạo lớp mẫu.");}}
  }}/>;
}
type InlineValue = ClassRecord[ClassEditKey];
function InlineClassField({field,record,catalog,commit}:{field:ClassEditKey;record:ClassRecord;catalog:ClassCatalog;commit:(field:ClassEditKey,value:InlineValue)=>boolean}){
  const original=String(record[field]??"");
  const [draft,setDraft]=useState(original);
  const [error,setError]=useState(false);
  const canceled=useRef(false);
  const label=classPropertyFields.find(f=>f.key===field)?.label??field;
  const numeric=["optimalConcurrentCapacity","hardConcurrentCapacity","defaultParticipationMinutes","weekdayIso"].includes(field);
  const options=field==="pathProgramId"?catalog.paths.filter(active).map(p=>[p.id,p.displayName]):field==="learningSpaceId"?eligibleClassSpaces(catalog,record.centerId).map(s=>[s.id,s.displayName]):field==="weekdayIso"?weekdays.map((day,i)=>[String(i+1),day]):field==="status"?CLASS_STATUSES.map(s=>[s,s]):null;
  const apply=(raw:string)=>{
    const value=numeric?(raw===""?null:Number(raw)):raw;
    if(raw===original){setError(false);return;}
    if(commit(field,value)){setError(false);}else{setDraft(original);setError(true);}
  };
  const common={id:"rc-"+field,"aria-label":label,className:controlClass,"data-pino-ds":"bo","data-pds-appearance":"underline","aria-invalid":error};
  if(options)return <select {...common} value={draft} onChange={e=>{setDraft(e.target.value);apply(e.target.value);}}>{!options.some(([id])=>id===original)&&<option value={original} disabled>{original}</option>}{options.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select>;
  return <input {...common} type={numeric?"number":field==="windowStartsLocal"||field==="windowEndsLocal"?"time":"text"} min={numeric?1:undefined} step={numeric?1:undefined} maxLength={field==="operationalName"?200:undefined} value={draft}
    onChange={e=>{setDraft(e.target.value);setError(false);}}
    onBlur={e=>{if(canceled.current){canceled.current=false;return;}apply(e.currentTarget.value);}}
    onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();e.currentTarget.blur();}else if(e.key==="Escape"){e.preventDefault();canceled.current=true;setDraft(original);setError(false);e.currentTarget.blur();}}}/>;
}
export function RunningClassDetailProperties({record,catalog,onSave,editable}:{
  record:ClassRecord;catalog:ClassCatalog;centerToday:string;editable:boolean;onSave:(command:ClassEditCommand)=>void;
}){
  const [error,setError]=useState("");
  const commit=(field:ClassEditKey,value:InlineValue)=>{
    const result=validateClassEdit(record,{...record,[field]:value},catalog);
    if(!result.ok){setError(result.message);return false;}
    try{onSave(result.command);setError("");return true;}catch(cause){setError(cause instanceof Error?cause.message:"Không thể lưu lớp mẫu.");return false;}
  };
  return <>
    <PropertySections variant="detail" fields={classPropertyFields} record={projectClassProperties(record,catalog)}
      sections={[{id:"identity",label:"Thông tin chính",fields:["operationalName","id","centerId","pathProgramId","learningSpaceId","status","version"]},{id:"schedule",label:"Lịch học",fields:["weekdayIso","windowStartsLocal","windowEndsLocal","deliveryTopology"]},{id:"capacity",label:"Sức chứa",fields:["optimalConcurrentCapacity","hardConcurrentCapacity","defaultParticipationMinutes"]},{id:"audit",label:"Thông tin hệ thống",fields:["createdAt","createdBy","updatedAt","updatedBy"]}]}
      canEdit={f=>editable&&CLASS_EDIT_KEYS.some(k=>k===f.key)} onEdit={()=>{}}
      directControl={f=><InlineClassField key={record.id+":"+f.key+":"+String(record[f.key as ClassEditKey])} field={f.key as ClassEditKey} record={record} catalog={catalog} commit={commit}/>}/>
    {error?<p className="pds-field-error" role="alert">{error}</p>:null}
  </>;
}
