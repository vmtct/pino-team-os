"use client";
import {useEffect,useRef,useState,type ReactNode} from "react";
import type {BoField,BoValue} from "@/lib/bo-registration";
import type {OverviewProperties} from "@/app/components/workspace-renderer/Properties";
import {PropertySections} from "@/app/components/workspace-renderer/Properties";
import {BoTypedEditor} from "@/app/bo/components/registration/BoTypedEditor";
import {BoApiError} from "@/lib/bo-api-error";
import {readSpecialtyV2Detail,readSpecialtyV2List,type SpecialtyV2Detail,type SpecialtyV2Summary} from "@/lib/ho-specialty-v2-reader";
import {postSpecialtyGraphCommand} from "@/lib/ho-specialty-v2-graph-client";
import {specialtyPublishWarnings} from "@/lib/ho-specialty-v2-publish";
import {ConfirmDialog} from "@pino/design-system/react";
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
 const [publishVersion,setPublishVersion]=useState<number|null>(null);
 const [unpublishVersion,setUnpublishVersion]=useState<number|null>(null);
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
 const activeStatusAllowed=canManage&&data?.detail.status==="ACTIVE"&&!saving;
 const editable=(field:BoField):field is BoField & {key:SpecialtyS5OverviewKey|"name"|"description"} =>
  (allowed&&["name","description","levelCount","prerequisiteView","tagView","status"].includes(field.key))||
  (activeStatusAllowed&&field.key==="status");
 const close=()=>{if(!saving)setSelection(null);};
 const props=properties;
 const options=selection&&data?(()=>{
  const field=selection.field;
  if(field.key==="status")return data.detail.status==="ACTIVE"?["Đang áp dụng","Bản nháp"]:["Bản nháp","Đang áp dụng"];
   if(field.key==="prerequisiteView")return eligibleSpecialtyPrerequisites(data.detail,data.catalog).map(x=>x.label);
  if(field.key==="tagView")return [...new Set([...data.catalog.flatMap(s=>s.tags),...["Nhân vật","Mỹ thuật","Sáng tạo","Anime","Gouache","Acrylic","Chibi"],...data.detail.tags])];
  return undefined;
 })():undefined;
 const value:BoValue=selection&&data?(()=>{
  switch(selection.field.key){
   case "status":return data.detail.status==="DRAFT"?"Bản nháp":"Đang áp dụng";
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
  if(!selection||!data||(!allowed&&!activeStatusAllowed)||saving)return;
  try{
   const field=selection.field.key;
    if(field==="status"){
     const isCurrent=(data.detail.status==="ACTIVE"&&value==="Đang áp dụng")||
       (data.detail.status==="DRAFT"&&value==="Bản nháp");
     if(isCurrent){setSelection(null);setError("");return;}
     if(value==="Đang áp dụng"&&data.detail.status==="DRAFT"){
       setSelection(null);setError("");setPublishVersion(data.detail.version);return;
     }
     if(value==="Bản nháp"&&data.detail.status==="ACTIVE"){
       setSelection(null);setError("");setUnpublishVersion(data.detail.version);return;
     }
     setError("Trạng thái không hợp lệ.");return;
    }
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
 async function publish(){
   if(publishVersion===null||!data||saving||!canManage)return;
   if(data.detail.status!=="DRAFT"||data.detail.version!==publishVersion){setPublishVersion(null);setRetry(n=>n+1);setError("Chuyên đề đã thay đổi. Tải lại trước khi xuất bản.");return;}
   if(specialtyPublishWarnings(data.detail,data.catalog).length)return;
   const command:SpecialtyGraphCommand={type:"PUBLISH",expectedVersion:publishVersion};
   const payload=JSON.stringify(command);
   if(!attempt.current||attempt.current.payload!==payload)
    attempt.current={payload,key:"spec_publish_"+crypto.randomUUID().replaceAll("-","")};
   const controller=new AbortController();pending.current=controller;
   setSaving(true);setError("");
   try{
    const detail=await postSpecialtyGraphCommand(id,command,window.fetch.bind(window),controller.signal,attempt.current.key);
    setData(previous=>previous?{...previous,detail}:previous);
    setPublishVersion(null);attempt.current=null;
    onSaved();
   }catch(cause){
    setError(cause instanceof BoApiError?cause.message:"Không thể xác minh xuất bản. Thử lại sau.");
    if(cause instanceof BoApiError&&cause.status===409){setPublishVersion(null);setRetry(n=>n+1);}
   }finally{pending.current=null;setSaving(false);}
  }
  /** PAP-1732: one Founder confirmation; no manual grant or dependent preflight. */
  async function unpublish(){
   if(unpublishVersion===null||!data||saving||!canManage)return;
   if(data.detail.status!=="ACTIVE"||data.detail.version!==unpublishVersion){
    setUnpublishVersion(null);setRetry(n=>n+1);
    setError("Chuyên đề đã thay đổi. Tải lại trước khi chuyển về bản nháp.");return;
   }
   const command:SpecialtyGraphCommand={type:"UNPUBLISH",expectedVersion:unpublishVersion};
   const payload=JSON.stringify(command);
   if(!attempt.current||attempt.current.payload!==payload)
    attempt.current={payload,key:"spec_unpublish_"+crypto.randomUUID().replaceAll("-","")};
   const controller=new AbortController();pending.current=controller;
   setSaving(true);setError("");
   try{
    const detail=await postSpecialtyGraphCommand(id,command,window.fetch.bind(window),controller.signal,attempt.current.key);
    setData(previous=>previous?{...previous,detail}:previous);
    setUnpublishVersion(null);attempt.current=null;
    onSaved();
   }catch(cause){
    setError(cause instanceof BoApiError?cause.message:"Không thể xác minh Unpublish. Thử lại sau.");
    if(cause instanceof BoApiError&&cause.status===409){setUnpublishVersion(null);setRetry(n=>n+1);}
   }finally{pending.current=null;setSaving(false);}
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
   {publishVersion!==null&&data?<ConfirmDialog
      surface="ho" context="Chuyên đề · Trạng thái" title="Xuất bản chuyên đề"
      subject={data.detail.name}
      description="Sau khi xuất bản, chuyên đề có thể được cấp cho học viên. Cấu hình DRAFT sẽ khóa và chưa thể hoàn tác."
      readyMessage="Đã kiểm tra cấu hình cơ bản. Core sẽ kiểm chứng trạng thái Mission, Path và tiên quyết khi lưu."
      confirmLabel="Xác nhận xuất bản" busyLabel="Đang xác minh…"
      warnings={specialtyPublishWarnings(data.detail,data.catalog)} busy={saving} error={error}
      onCancel={()=>{if(!saving){setPublishVersion(null);setError("");}}}
      onConfirm={()=>{void publish();}}/>:null}
   {unpublishVersion!==null&&data?<ConfirmDialog
      surface="ho" context="Chuyên đề · Trạng thái" title="Chuyển về bản nháp"
      subject={data.detail.name}
      description="Ngừng cấp quyền học mới ngay. Các quyền đã cấp vẫn tiếp tục theo phiên bản Published và tiến độ cũ. Không cần chuẩn bị snapshot hay xử lý Grant/tiên quyết."
      readyMessage="Hệ thống tự bảo lưu lịch sử Published; chuyển về Bản nháp để chỉnh sửa, không thu hồi quyền cũ."
      confirmLabel="Xác nhận về nháp" busyLabel="Đang chuyển về nháp…"
      warnings={[]} busy={saving} error={error}
      onCancel={()=>{if(!saving){setUnpublishVersion(null);setError("");}}}
      onConfirm={()=>{void unpublish();}}/>:null}
 </>;
}
