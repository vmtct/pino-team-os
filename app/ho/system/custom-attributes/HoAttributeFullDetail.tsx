"use client";
/** PAP-1874 / Epic PAP-1665 PLT-ATTR FSG4 — native DSA Full Detail, read-only. */
import {useEffect,useMemo,useState} from "react";
import {DetailFrame} from "@/app/components/workspace-renderer/DetailFrame";
import {PropertySections} from "@/app/components/workspace-renderer/Properties";
import {attributeModule,asRecord,type AttributeDefinition,type CenterOption} from "@/lib/ho-attribute-model";

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
export function HoAttributeFullDetail({id,centers,mobileMenu,onBack}:{
 id:string;centers:CenterOption[];mobileMenu:React.ReactNode;onBack:()=>void;
}){
 const [tab,setTab]=useState<"overview"|"history">("overview");
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
   if(event.key==="Escape"){event.preventDefault();onBack();}
  };
  document.addEventListener("keydown",escape);
  return()=>document.removeEventListener("keydown",escape);
 },[onBack]);
 const record=useMemo(()=>detail?asRecord(detail,centers):null,[detail,centers]);
 return <DetailFrame title={detail?.displayName??"Thuộc tính bổ sung"}
  subtitle={detail?detail.entityType+" · "+(detail.scope==="GLOBAL"?"Toàn hệ thống":
   centers.find(c=>c.id===detail.centerId)?.label??"Trung tâm"):""}
  mobileMenu={mobileMenu} onBack={onBack} tabs={tabs} selected={tab} onSelect={next=>setTab(next as typeof tab)}>
  {detailLoading?<p role="status">Đang tải thuộc tính từ Core…</p>:
   detailError?<div role="alert">{detailError} <button type="button" onClick={()=>{setDetailLoading(true);setDetailRetry(v=>v+1)}}>Thử lại</button></div>:
   !record?<p role="alert">Không có dữ liệu được phép xem.</p>:
   tab==="overview"?<PropertySections variant="detail" fields={attributeModule.fields}
     record={record} sections={sections}/>:
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
