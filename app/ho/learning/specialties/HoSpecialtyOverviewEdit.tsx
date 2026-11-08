"use client";
import {useEffect,useRef,useState,type ReactNode} from "react";
import type {BoField,BoValue} from "@/lib/bo-registration";
import type {OverviewProperties} from "@/app/components/workspace-renderer/Properties";
import {PropertySections} from "@/app/components/workspace-renderer/Properties";
import {BoTypedEditor} from "@/app/bo/components/registration/BoTypedEditor";
import {BoApiError} from "@/lib/bo-api-error";
import {readSpecialtyV2Detail,readSpecialtyV2List,type SpecialtyV2Detail,type SpecialtyV2Summary} from "@/lib/ho-specialty-v2-reader";
import {postSpecialtyGraphCommand} from "@/lib/ho-specialty-v2-graph-client";
import {eligibleSpecialtyPrerequisites,planSpecialtyOverviewEdit,type SpecialtyS5OverviewKey} from "@/lib/ho-specialty-s5-overview";
import {planSpecialtyMetadataEdit,type SpecialtyMetadataPatch} from "@/lib/ho-specialty-s5-metadata";
import {putSpecialtyMetadataEdit} from "@/lib/ho-specialty-v2-metadata-client";
import type {SpecialtyGraphCommand} from "@/lib/ho-specialty-v2-graph-client";

/** S5 explicitly authorized Founder action: shared DS property grid/typed editor, not TDD mutation transport. */
export function HoSpecialtyOverviewEdit({properties,canManage,onSaved}:{
 properties:OverviewProperties;canManage:boolean;onSaved:()=>void;
}):ReactNode{
 const id=properties.record.id;
 const [data,setData]=useState<{detail:SpecialtyV2Detail;catalog:SpecialtyV2Summary[]}|null>(null);
 const [error,setError]=useState("");
 const [retry,setRetry]=useState(0);
 const [selection,setSelection]=useState<{field:BoField;anchor:HTMLElement}|null>(null);
 const [saving,setSaving]=useState(false);
 const pending=useRef<AbortController|null>(null);
 const attempt=useRef<{payload:string;key:string}|null>(null);
 const [labelWidth,setLabelWidth]=useState(160);
 useEffect(()=>{
  const controller=new AbortController();
  void Promise.all([
    readSpecialtyV2Detail(id,window.fetch.bind(window),controller.signal),
    readSpecialtyV2List(window.fetch.bind(window),controller.signal),
  ]).then(([detail,catalog])=>{
    if(!controller.signal.aborted)setData({detail,catalog});
  }).catch(()=>{
    if(!controller.signal.aborted)setError("Không thể xác minh dữ liệu chỉnh sửa Chuyên đề từ Core.");
  });
  return ()=>{controller.abort();pending.current?.abort();};
 },[id,retry]);
 const allowed=canManage&&data?.detail.status==="DRAFT"&&!saving;
 const editable=(field:BoField):field is BoField & {key:SpecialtyS5OverviewKey|"name"|"description"} =>
  allowed&&["name","description","levelCount","prerequisiteView","tagView"].includes(field.key);
 const close=()=>{if(!saving)setSelection(null);};
 const props=properties;
 const options=selection&&data?(()=>{
  const field=selection.field;
  if(field.key==="prerequisiteView")return eligibleSpecialtyPrerequisites(data.detail,data.catalog).map(x=>x.label);
  if(field.key==="tagView")return [...new Set([...data.catalog.flatMap(s=>s.tags),...["Nhân vật","Mỹ thuật","Sáng tạo","Anime","Gouache","Acrylic","Chibi"],...data.detail.tags])];
  return undefined;
 })():undefined;
 const value:BoValue=selection&&data?(()=>{
  switch(selection.field.key){
   case "name":return data.detail.name;
   case "description":return data.detail.description??"";
   case "levelCount":return data.detail.levels.length;
   case "tagView":return data.detail.tags;
   case "prerequisiteView":{
    const byId=new Map(eligibleSpecialtyPrerequisites(data.detail,data.catalog).map(x=>[x.id,x.label]));
    return data.detail.prerequisiteIds.map(id=>byId.get(id)??"");
   }
   default:return null;
  }
 })():null;
 async function save(value:BoValue){
  if(!selection||!data||!allowed||saving)return;
  try{
   const field=selection.field.key;
   const metadata=field==="name"||field==="description";
   const command=metadata?planSpecialtyMetadataEdit(data.detail,data.catalog,field,value):
    planSpecialtyOverviewEdit(data.detail,data.catalog,field as SpecialtyS5OverviewKey,value);
   const payload=JSON.stringify(command);
   if(!attempt.current||attempt.current.payload!==payload)
    attempt.current={payload,key:"spec_s5_"+crypto.randomUUID().replaceAll("-","")};
   const controller=new AbortController();
   pending.current=controller;
   setSaving(true);setError("");
   const detail=metadata?
    await putSpecialtyMetadataEdit(id,command as SpecialtyMetadataPatch,window.fetch.bind(window),controller.signal,attempt.current.key):
    await postSpecialtyGraphCommand(id,command as SpecialtyGraphCommand,window.fetch.bind(window),controller.signal,attempt.current.key);
   setData(previous=>previous?{...previous,detail}:previous);
   setSelection(null);
   attempt.current=null;
   onSaved(); // Refresh the already-mounted TDD Detail + Table; do not lose current tab/query/focus.
  }catch(cause){
   if(cause instanceof BoApiError)setError(cause.message);
   else setError("Không thể xác minh chỉnh sửa. Tải lại và thử lại.");
  }finally{
   pending.current=null;setSaving(false);
  }
 }
 return <>
  <PropertySections variant="detail" fields={props.fields} record={props.record} sections={props.sections}
    canEdit={editable} onEdit={(field,anchor)=>{attempt.current=null;setError("");setSelection({field,anchor});}}
    labelWidth={labelWidth} onLabelWidthChange={setLabelWidth}/>
  {!data&&!error?<p role="status">Đang kiểm tra quyền chỉnh sửa và dữ liệu Core…</p>:null}
  {error?<p role="alert">{error} <button type="button" disabled={saving} onClick={()=>{
    setError("");setData(null);setSelection(null);setRetry(n=>n+1);
  }}>Tải lại</button></p>:null}
  {saving?<p role="status">Đang lưu và xác minh Core…</p>:null}
  {selection&&data&&!saving?<BoTypedEditor key={selection.field.key} field={{
      ...selection.field,readonly:false,...(options?{options}:{}),
    }} value={value} anchor={selection.anchor} onClose={close} onSave={v=>{void save(v);}}
    closeOnSave={false}/>:null}
 </>;
}
