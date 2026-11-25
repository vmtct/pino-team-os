"use client";
/** PLT-DELIVERY / PAP-1043 / PAP-2225 — shared native renderer controls.
 * Command callbacks are injected by the owning workspace; no live API or storage here.
 */
import {useState,type ReactNode} from "react";
import {BoQuickView} from "../components/registration/BoQuickView";
import {PropertySections,type CreateDrawerField} from "@/app/components/workspace-renderer/Properties";
import type {BoModule} from "@/lib/bo-registration";
import {CLASS_TOPOLOGIES,initialClassDraft,changeClassCenter,eligibleClassSpaces,validateClassDraft,type ClassCatalog,type ClassDraft,type ClassCreate,type ClassTopology} from "./running-class-draft";
import {CLASS_EDIT_KEYS,classPropertyFields,projectClassProperties,validateClassEdit,type ClassRecord,type ClassEditCommand} from "./running-class-presentation";

const weekdays=["Thứ hai","Thứ ba","Thứ tư","Thứ năm","Thứ sáu","Thứ bảy","Chủ nhật"];
const topologyLabel:Record<ClassTopology,string>={FIXED_COHORT:"Fixed cohort",FLEXIBLE_STUDIO:"Flexible studio",OVERLAPPING_COHORT:"Overlapping cohort"};
const active=(item:{status:string})=>item.status.toUpperCase()==="ACTIVE";
const controlClass="property-control os-create-select";
type Update=<K extends keyof ClassDraft>(key:K,value:ClassDraft[K])=>void;
function classControls(draft:ClassDraft,catalog:ClassCatalog,update:Update,disabled=false):Record<keyof ClassDraft,ReactNode>{
  const input=(key:"operationalName"|"windowStartsLocal"|"windowEndsLocal",label:string,type:"text"|"time")=>
    <input id={"rc-"+key} aria-label={label} className={controlClass} type={type} maxLength={type==="text"?200:undefined}
      required disabled={disabled} value={draft[key]} onChange={e=>update(key,e.target.value)} />;
  const num=(key:"optimalConcurrentCapacity"|"hardConcurrentCapacity"|"defaultParticipationMinutes",label:string,required=false)=>
    <input id={"rc-"+key} aria-label={label} className={controlClass} type="number" min={1} step={1}
      required={required} disabled={disabled} value={draft[key]??""} onChange={e=>update(key,e.target.value===""?null:Number(e.target.value))}/>;
  const select=(key:"centerId"|"pathProgramId"|"learningSpaceId",label:string,rows:readonly {id:string;displayName:string}[])=>
    <select id={"rc-"+key} aria-label={label} className={controlClass} required disabled={disabled} value={draft[key]} onChange={e=>update(key,e.target.value)}>
      <option value="">Chọn {label}</option>{rows.map(r=><option key={r.id} value={r.id}>{r.displayName}</option>)}</select>;
  return {
    operationalName:input("operationalName","Tên lớp","text"),
    centerId:select("centerId","Cơ sở",catalog.centers.filter(active)),
    pathProgramId:select("pathProgramId","Path",catalog.paths.filter(active)),
    learningSpaceId:select("learningSpaceId","Không gian học",eligibleClassSpaces(catalog,draft.centerId)),
    weekdayIso:<select id="rc-weekdayIso" aria-label="Thứ" className={controlClass} disabled={disabled} value={draft.weekdayIso} onChange={e=>update("weekdayIso",Number(e.target.value))}>{weekdays.map((day,i)=><option key={day} value={i+1}>{day}</option>)}</select>,
    windowStartsLocal:input("windowStartsLocal","Giờ bắt đầu","time"),
    windowEndsLocal:input("windowEndsLocal","Giờ kết thúc","time"),
    deliveryTopology:<select id="rc-deliveryTopology" aria-label="Mô hình" className={controlClass} disabled={disabled} value={draft.deliveryTopology} onChange={e=>update("deliveryTopology",e.target.value as ClassTopology)}>{CLASS_TOPOLOGIES.map(t=><option key={t} value={t}>{topologyLabel[t]}</option>)}</select>,
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
  const module:BoModule={label:"Running Class",group:"SCHOOL",fields:creationFields};
  return <BoQuickView module={module} moduleKey="classes" record={null} onClose={onClose} create={{
    draft:{...draft,id:"",name:draft.operationalName,status:"INACTIVE"},fields:creationFields,editable:()=>false,createFields:fields,
    onChange:()=>{},error,title:"Tạo Running Class",path:"School / Running Class",
    onCreate:()=>{const result=validateClassDraft(draft,catalog);if(!result.ok){setError(Object.values(result.errors).join(" "));return;}onCreate(result.value);}
  }}/>;
}
export function RunningClassDetailProperties({record,catalog,centerToday,onSave,editable}:{
  record:ClassRecord;catalog:ClassCatalog;centerToday:string;editable:boolean;onSave:(command:ClassEditCommand)=>void;
}){
  const [draft,setDraft]=useState<ClassDraft|null>(null);
  const [effective,setEffective]=useState("");
  const [error,setError]=useState("");
  const current=draft??record;
  const update:Update=(key,value)=>{if(!draft||!CLASS_EDIT_KEYS.some(k=>k===key))return;setDraft({...draft,[key]:value});setError("");};
  const controls=classControls(current,catalog,update);
  const props=projectClassProperties(record,catalog);
  return <>
    <PropertySections variant="detail" fields={classPropertyFields} record={props}
      sections={[{id:"properties",label:"Thông tin chính",fields:classPropertyFields.map(f=>f.key)}]}
      canEdit={f=>Boolean(draft&&editable&&CLASS_EDIT_KEYS.some(k=>k===f.key))}
      onEdit={()=>{}} directControl={f=>controls[f.key as keyof ClassDraft]}
      sectionActions={()=>editable&&!draft?<button type="button" className="secondary-btn" onClick={()=>{setDraft({...record});setEffective("");setError("");}}>Chỉnh sửa</button>:null}/>
    {draft&&editable?<div className="v24-prop-section"><label htmlFor="rc-effective">Ngày hiệu lực khi thay đổi lịch hoặc sức chứa</label>
      <input className={controlClass} id="rc-effective" type="date" min={centerToday} value={effective} onChange={e=>setEffective(e.target.value)}/>
      <p className="settings-hint">Không thay đổi các buổi học đã được tạo hoặc Enrollment hiện hữu.</p>
      {error?<p className="edit-error" role="alert">{error}</p>:null}
      <button type="button" className="secondary-btn" onClick={()=>{setDraft(null);setError("");}}>Hủy</button>{" "}
      <button type="button" className="primary-btn" onClick={()=>{const result=validateClassEdit(record,draft,catalog,effective,centerToday);if(!result.ok){setError(result.message);return;}onSave(result.command);setDraft(null);setError("");}}>Lưu</button>
    </div>:null}
  </>;
}
