"use client";
/** PAP-1874 / Epic PAP-1665 PLT-ATTR FSG4 — native DSA Full Detail, read-only. */
import {useEffect,useMemo,useRef,useState} from "react";
import {BoTypedEditor} from "@/app/bo/components/registration/BoTypedEditor";
import type {BoField,BoRecord,BoValue} from "@/lib/bo-registration";
import {DetailFrame} from "@/app/components/workspace-renderer/DetailFrame";
import {editorOwnsDialogKey} from "@/app/components/workspace-renderer/dialog";
import {PropertySections} from "@/app/components/workspace-renderer/Properties";
import {attributeModule,optionsField,needsOptions,VISIBILITY,asRecord,type AttributeDefinition,type CenterOption} from "@/lib/ho-attribute-model";

type HistoryEvent={
 action:"DEFINITION_CREATED"|"DEFINITION_UPDATED"|"DEFINITION_LIFECYCLE";
 revision:number;occurredAt:string;actorName:string|null;
};
type HistoryPage={items:HistoryEvent[];total:number;limit:number;offset:number};
const endpoint="/api/ho/custom-attributes/definitions/";
const tabs=[{id:"overview",label:"Tổng quan"},{id:"history",label:"Lịch sử"}] as const;
const propertyKeys=attributeModule.fields.map(f=>f.key);
const sections=[
 {id:"properties",label:"Thuộc tính",fields:propertyKeys.slice(0,10)},
 {id:"audit",label:"Lịch sử hệ thống",fields:propertyKeys.slice(10)}
];
function errorMessage(status:number):string{
 return status===401||status===403?"Không có quyền Founder để xem thuộc tính này.":
  status===404?"Thuộc tính không tồn tại hoặc không còn được phép xem.":
  "Không thể tải dữ liệu từ Core. Vui lòng thử lại.";
}
function stamp(raw:string):string{
 const date=new Date(raw);if(!Number.isFinite(date.getTime()))return "—";
 return new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Ho_Chi_Minh",
  day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(date).replace(","," ·");
}
function isDefinition(v:unknown):v is AttributeDefinition{
 return Boolean(v&&typeof v==="object"&&"id" in v&&typeof v.id==="string"&&
  "displayName" in v&&typeof v.displayName==="string"&&
  "createdAt" in v&&typeof v.createdAt==="string"&&
  "revision" in v&&typeof v.revision==="number");
}
function isHistory(v:unknown):v is HistoryPage{
 return Boolean(v&&typeof v==="object"&&"items" in v&&Array.isArray(v.items)&&
  "total" in v&&Number.isSafeInteger(v.total)&&"limit" in v&&v.limit===20&&
  "offset" in v&&Number.isSafeInteger(v.offset)&&v.items.every((e:unknown)=>
   Boolean(e&&typeof e==="object"&&"action" in e&&typeof e.action==="string"&&
    "revision" in e&&Number.isSafeInteger(e.revision)&&
    "occurredAt" in e&&typeof e.occurredAt==="string")));
}
export function HoAttributeFullDetail({id,centers,mobileMenu,onBack,onUpdated}:{
 id:string;centers:CenterOption[];mobileMenu:React.ReactNode;onBack:()=>void;onUpdated:(next:AttributeDefinition)=>void;
}){
 const [tab,setTab]=useState<"overview"|"history">("overview");
 const [selectedCenter,setSelectedCenter]=useState("");
 const [editor,setEditor]=useState<{field:BoField;anchor:HTMLButtonElement}|null>(null);
 const [editError,setEditError]=useState("");
 const [saving,setSaving]=useState(false);
 const savingRef=useRef(false);
 const [detail,setDetail]=useState<AttributeDefinition|null>(null);
 const [detailError,setDetailError]=useState("");
 const [detailLoading,setDetailLoading]=useState(true);
 const [detailRetry,setDetailRetry]=useState(0);
 const [offset,setOffset]=useState(0),[historyRetry,setHistoryRetry]=useState(0);
 const [history,setHistory]=useState<HistoryPage|null>(null);
 const [historyError,setHistoryError]=useState("");
 const [historyLoading,setHistoryLoading]=useState(false);
 useEffect(()=>{
  const controller=new AbortController();
  void(async()=>{
   try{
    const r=await fetch(endpoint+encodeURIComponent(id),{cache:"no-store",signal:controller.signal});
    if(!r.ok)throw Error(errorMessage(r.status));
    const json=await r.json() as {data?:unknown};
    if(!isDefinition(json.data)||json.data.id!==id)throw Error("Core trả về thuộc tính không hợp lệ.");
    if(!controller.signal.aborted){setDetail(json.data);setDetailError("");}
   }catch(err){if(!controller.signal.aborted){setDetail(null);
    setDetailError(err instanceof Error?err.message:"Không thể tải thuộc tính.");}}
   finally{if(!controller.signal.aborted)setDetailLoading(false);}
  })();
  return()=>controller.abort();
 },[id,detailRetry]);
 useEffect(()=>{
  if(tab!=="history"||!detail)return;
  const controller=new AbortController();
  queueMicrotask(()=>{if(!controller.signal.aborted)setHistoryLoading(true)});
  void(async()=>{
   try{
    const r=await fetch(endpoint+encodeURIComponent(id)+"/history?limit=20&offset="+offset,
     {cache:"no-store",signal:controller.signal});
    if(!r.ok)throw Error(errorMessage(r.status));
    const json=await r.json() as {data?:unknown};
    if(!isHistory(json.data)||json.data.offset!==offset)throw Error("Lịch sử Core chưa hợp lệ.");
    if(!controller.signal.aborted){setHistory(json.data);setHistoryError("");}
   }catch(err){if(!controller.signal.aborted){setHistory(null);
    setHistoryError(err instanceof Error?err.message:"Không thể tải lịch sử.");}}
   finally{if(!controller.signal.aborted)setHistoryLoading(false);}
  })();
  return()=>controller.abort();
 },[tab,id,detail,offset,historyRetry]);
 useEffect(()=>{
  const escape=(event:KeyboardEvent)=>{
   if(event.key!=="Escape"||event.defaultPrevented||event.repeat)return;
   // PAP-1986: the first Escape belongs to the original editor, even after React unmounts it.
   if(editorOwnsDialogKey(event)||document.querySelector('.edit-popover:not(.hidden)'))return;
   event.preventDefault();onBack();
  };
  document.addEventListener("keydown",escape);
  return()=>document.removeEventListener("keydown",escape);
 },[onBack]);
 const selectedCenterId=detail?.scope==="CENTER"?detail.centerId??"":selectedCenter;
 const centerValid=centers.some(c=>c.id===selectedCenterId);
 const canWrite=Boolean(detail?.status==="DRAFT"&&centerValid);
 const record=useMemo<BoRecord|null>(()=>detail?{...asRecord(detail,centers),
  ...(needsOptions(detail.valueType)?{options:detail.options.join("\n")}:{})}:null,[detail,centers]);
 const detailFields=detail&&needsOptions(detail.valueType)?[...attributeModule.fields,optionsField]:attributeModule.fields;
 const detailSections=detail&&needsOptions(detail.valueType)?[
  {...sections[0],fields:[...sections[0].fields,"options"]},sections[1]
 ]:sections;
 const editable=new Set(["displayName","required","visibility","options"]);
 /** PAP-1905 / PAP-1665: one native DSA popover, one Core CAS command, real readback. */
 async function saveMetadata(raw:BoValue):Promise<void>{
  if(savingRef.current||!detail||!editor||!canWrite||!selectedCenterId)return;
  const field=editor.field.key;
  let value:unknown;
  if(field==="displayName")value=String(raw??"").trim();
  else if(field==="required")value=raw===true;
  else if(field==="visibility")value=Array.isArray(raw)?raw:[];
  else if(field==="options")value=String(raw??"").split(/[,\n]/).map(x=>x.trim()).filter(Boolean);
  else return;
  if(field==="displayName"&&(!value||(value as string).length>120)){
   setEditError("Tên thuộc tính cần từ 1–120 ký tự.");return;
  }
  if(field==="visibility"&&(!(value as string[]).length||
   (value as string[]).some(x=>!VISIBILITY.includes(x as typeof VISIBILITY[number]))||
   new Set(value as string[]).size!==(value as string[]).length)){
   setEditError("Chọn ít nhất một nơi hiển thị hợp lệ.");return;
  }
  if(field==="options"&&(!(value as string[]).length||(value as string[]).length>50||
   new Set((value as string[]).map(x=>x.normalize("NFKC").toLowerCase())).size!==(value as string[]).length)){
   setEditError("Nhập 1–50 lựa chọn khác nhau.");return;
  }
  savingRef.current=true;setSaving(true);setEditError("");
  try{
   const endpointForId=endpoint+encodeURIComponent(id);
   const response=await fetch(endpointForId,{method:"PATCH",cache:"no-store",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({selectedCenterId,expectedRevision:detail.revision,[field]:value})});
   if(!response.ok)throw Error(response.status===409?
    "Phiên bản thay đổi. Đã ngừng lưu; tải lại trước khi thử.":
    response.status===403||response.status===401?"Founder hoặc Trung tâm không có quyền sửa.":
    response.status===400||response.status===422?"Dữ liệu chỉnh sửa chưa hợp lệ.":errorMessage(response.status));
   const patched=await response.json() as {data?:unknown};
   if(!isDefinition(patched.data)||patched.data.revision!==detail.revision+1)
    throw Error("Core không xác nhận phiên bản mới.");
   const readResponse=await fetch(endpointForId,{cache:"no-store"});
   const read=await readResponse.json() as {data?:unknown};
   if(!readResponse.ok||!isDefinition(read.data)||read.data.id!==id||
      read.data.revision!==patched.data.revision||
      JSON.stringify(read.data[field as keyof AttributeDefinition])!==JSON.stringify(value))
    throw Error("Core readback chưa trùng khớp; cần kiểm tra lại.");
   setDetail(read.data);onUpdated(read.data);setHistoryRetry(n=>n+1);
   setEditor(null);
  }catch(error){
   setEditError(error instanceof Error?error.message:"Không thể xác nhận cập nhật.");
   if(error instanceof Error&&error.message.includes("Phiên bản thay đổi")){
    setEditor(null);setDetailLoading(true);setDetailRetry(n=>n+1);
   }
  }finally{savingRef.current=false;setSaving(false);}
 }
 return <DetailFrame title={detail?.displayName??"Thuộc tính tùy chỉnh"}
  subtitle={detail?detail.entityType+" · "+(detail.scope==="GLOBAL"?"Toàn hệ thống":
   centers.find(c=>c.id===detail.centerId)?.label??"Trung tâm"):""}
  mobileMenu={mobileMenu} onBack={onBack} tabs={tabs} selected={tab} onSelect={next=>{
   setTab(next as typeof tab);setEditor(null);setEditError("");}}>
  {detailLoading?<p role="status">Đang tải thuộc tính từ Core…</p>:
   detailError?<div role="alert">{detailError} <button type="button" onClick={()=>{setDetailLoading(true);setDetailRetry(v=>v+1)}}>Thử lại</button></div>:
   !record?<p role="alert">Không có dữ liệu được phép xem.</p>:
   tab==="overview"?<>
    {detail?.status==="DRAFT"?<div role="group" aria-label="Trung tâm thao tác Founder">
     {detail.scope==="GLOBAL"?<label htmlFor="attribute-selected-center">Trung tâm thao tác
      <select id="attribute-selected-center" className="edit-input" value={selectedCenter}
       onChange={e=>{setSelectedCenter(e.target.value);setEditor(null);setEditError("");}}>
       <option value="">— Chọn Trung tâm —</option>
       {centers.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
      </select></label>:
      <p role="status">Trung tâm thao tác: {centers.find(c=>c.id===detail.centerId)?.label??"Chưa được cấp quyền"}</p>}
     {!centerValid?<p role="status">Chọn Trung tâm hợp lệ để sửa thuộc tính DRAFT.</p>:null}
    </div>:null}
    <PropertySections variant="detail" fields={detailFields}
     record={record} sections={detailSections}
     canEdit={field=>canWrite&&editable.has(field.key)}
     onEdit={(field,anchor)=>{setEditor({field,anchor});setEditError("");}}/>
    {editor&&canWrite?<BoTypedEditor key={editor.field.key+":"+(detail?.revision??0)}
     field={{...editor.field,readonly:false,
      options:editor.field.key==="visibility"?[...VISIBILITY]:editor.field.options}}
     value={record[editor.field.key] as BoValue} anchor={editor.anchor}
     closeOnSave={false} onClose={()=>{if(!savingRef.current){setEditor(null);setEditError("");}}}
     onSave={next=>{void saveMetadata(next);}}/>:null}
    {saving?<p role="status">Đang xác minh Core readback…</p>:null}
    {editError?<p role="alert">{editError}</p>:null}
   </>:
   <section data-plt-attr-history="" aria-label="Lịch sử thuộc tính">
    {historyLoading?<p role="status">Đang đọc lịch sử từ Core…</p>:
     historyError?<div role="alert">{historyError} <button type="button" onClick={()=>setHistoryRetry(v=>v+1)}>Thử lại</button></div>:
     !history?.total?<p role="status">Chưa có sự kiện lịch sử.</p>:
     <><p role="status">{history.total} sự kiện từ Core</p>
     <ol className="v24-history-list">{history.items.map((event,index)=>
      <li key={offset+index} className="v24-prop-item" data-history-event={event.action}>
       <strong>{event.action==="DEFINITION_CREATED"?"Tạo thuộc tính":
        event.action==="DEFINITION_UPDATED"?"Cập nhật thuộc tính":"Thay đổi vòng đời"}</strong>
       <p>Phiên bản {event.revision} · {stamp(event.occurredAt)} · {event.actorName?.trim()||"—"}</p>
      </li>)}</ol>
     <nav aria-label="Phân trang lịch sử">
      <button type="button" disabled={offset===0} onClick={()=>setOffset(v=>Math.max(0,v-20))}>Trước</button>
      <span> {offset+1}–{Math.min(offset+20,history.total)} / {history.total} </span>
      <button type="button" disabled={offset+20>=history.total} onClick={()=>setOffset(v=>v+20)}>Sau</button>
     </nav></>}
   </section>}
 </DetailFrame>;
}
