"use client";
import { lazy, Suspense, useEffect, useState, type KeyboardEvent } from "react";
import { BoValue } from "./BoValue";
import type { BoDataGridColumn } from "../data-grid/BoDataGrid";
const BoDataGrid = lazy(async () => ({ default: (await import("../data-grid/BoDataGrid")).BoDataGrid }));
import type { BoModule, BoRecord } from "@/lib/bo-registration";

const tabs = ["Overview", "Students", "Contacts", "Audit"] as const;
type ParentTab = (typeof tabs)[number];
type Student = { id: string; name: string; relationship: string; linkedAt: string };
type Contact = { id: string; type: "PHONE" | "EMAIL"; maskedValue: string; primary: boolean; verified: boolean };
type Audit = { id: string; at: string; action: string; outcome: string; actorType: string };
type Detail = { id: string; students: Student[]; contacts: Contact[]; audit: Audit[]; auditAuthorized: boolean };
const idPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const studentColumns: BoDataGridColumn<Student>[]=[
  {key:"name",header:"Học viên",render:r=>r.name},{key:"relationship",header:"Quan hệ",render:r=>r.relationship},
  {key:"linkedAt",header:"Liên kết từ",render:r=>r.linkedAt.slice(0,10)}
];
const contactColumns: BoDataGridColumn<Contact>[]=[
  {key:"type",header:"Loại",render:r=>r.type},{key:"maskedValue",header:"Liên hệ (đã che)",render:r=>r.maskedValue},
  {key:"primary",header:"Chính",render:r=>r.primary?"Có":"Không"},{key:"verified",header:"Xác minh",render:r=>r.verified?"Đã xác minh":"Chưa xác minh"}
];
const auditColumns: BoDataGridColumn<Audit>[]=[
  {key:"at",header:"Thời điểm",render:r=>r.at},{key:"action",header:"Hành động",render:r=>r.action},
  {key:"actorType",header:"Tác nhân",render:r=>r.actorType},{key:"outcome",header:"Kết quả",render:r=>r.outcome}
];
function valid(value: unknown, expectedId: string): value is Detail {
 if(!value || typeof value!=="object")return false;
 const d=value as Record<string,unknown>;
 if(d.id!==expectedId||typeof d.auditAuthorized!=="boolean")return false;
 const students=d.students,contacts=d.contacts,audit=d.audit;
 if(!Array.isArray(students)||!Array.isArray(contacts)||!Array.isArray(audit)||[students,contacts,audit].some(a=>a.length>100))return false;
 return students.every(x=>x&&idPattern.test(x.id)&&typeof x.name==="string"&&typeof x.relationship==="string"&&typeof x.linkedAt==="string") &&
   contacts.every(x=>x&&idPattern.test(x.id)&&["PHONE","EMAIL"].includes(x.type)&&typeof x.maskedValue==="string"&&/[•*]/.test(x.maskedValue)&&typeof x.primary==="boolean"&&typeof x.verified==="boolean") &&
   audit.every(x=>x&&idPattern.test(x.id)&&typeof x.at==="string"&&typeof x.action==="string"&&typeof x.outcome==="string"&&typeof x.actorType==="string");
}
export function BoParentReadTabs({ module, record }: { module: BoModule; record: BoRecord }) {
  const [tab,setTab]=useState<ParentTab>("Overview");
  const [detail,setDetail]=useState<Detail|null>(null);
  const [status,setStatus]=useState<"loading"|"ready"|"error"|"permission">("loading");
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    setStatus("loading");setDetail(null);
    (async()=>{
      const r=await fetch("/api/bo/identity/parents/"+encodeURIComponent(record.id)+"/detail",{
        method:"GET",credentials:"same-origin",cache:"no-store",redirect:"error",signal:controller.signal
      });
      if(r.status===401||r.status===403||r.status===404){setStatus("permission");return;}
      if(!r.ok)throw Error("Parent detail read failed");
      const envelope=await r.json() as {data?:unknown};
      if(!valid(envelope.data,record.id))throw Error("Core Parent detail contract mismatch");
      setDetail(envelope.data);setStatus("ready");
    })().catch(()=>{if(!controller.signal.aborted)setStatus("error")});
    return ()=>controller.abort();
  },[record.id,retry]);
  function keydown(event:KeyboardEvent<HTMLButtonElement>,index:number){
    if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
    event.preventDefault();
    const next=event.key==="Home"?0:event.key==="End"?tabs.length-1:(index+(event.key==="ArrowRight"?1:-1)+tabs.length)%tabs.length;
    setTab(tabs[next]);event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  }
  const overview=<div className="v24-prop-grid">{module.fields.map(field=><div className="v24-prop-item" key={field.key}>
    <div className="v24-prop-key"><span className="v24-field-glyph">{field.icon}</span>{field.label}</div>
    <div className="v24-prop-value readonly" aria-label={"Chỉ đọc "+field.label}><BoValue field={field} value={record[field.key]} full /></div>
  </div>)}</div>;
  return <section aria-label="Parents & Guardians">
    <div className="detail-tabs" role="tablist" aria-label="Parent">{tabs.map((item,index)=><button type="button" role="tab"
      key={item} id={"parent-tab-"+item.toLowerCase()} aria-selected={item===tab} aria-controls="parent-tab-panel"
      tabIndex={item===tab?0:-1} className={"detail-tab"+(item===tab?" selected":"")}
      onClick={()=>setTab(item)} onKeyDown={event=>keydown(event,index)}>{item}</button>)}</div>
    <section id="parent-tab-panel" role="tabpanel" aria-labelledby={"parent-tab-"+tab.toLowerCase()} className="v24-prop-section">
      <Suspense fallback={<div role="status">Đang tải bảng…</div>}>
      {tab==="Overview"?overview:status!=="ready"||!detail?
       <div className="v24-audit-empty" role="status">{status==="loading"?"Đang tải dữ liệu Core…":
         status==="permission"?"Không có quyền xem dữ liệu Parent này.":
         <>Không thể tải dữ liệu. <button type="button" onClick={()=>setRetry(n=>n+1)}>Thử lại</button></>}</div>:
       tab==="Students"?<BoDataGrid rows={detail.students} columns={studentColumns} rowKey={r=>r.id} caption="Học viên liên kết hiện tại"
          emptyTitle="Chưa có liên kết" emptyMessage="Không có học viên liên kết trong phạm vi cơ sở được cấp quyền."/>:
       tab==="Contacts"?<BoDataGrid rows={detail.contacts} columns={contactColumns} rowKey={r=>r.id} caption="Liên hệ đã che"
          emptyTitle="Không có liên hệ" emptyMessage="Không có liên hệ đang hoạt động."/>:
       detail.auditAuthorized?<BoDataGrid rows={detail.audit} columns={auditColumns} rowKey={r=>r.id} caption="Lịch sử Audit"
          emptyTitle="Chưa có Audit" emptyMessage="Chưa có sự kiện audit liên quan được phép xem."/>:
         <div role="status" className="v24-audit-empty">Không có quyền xem lịch sử Audit.</div>}
      </Suspense>
    </section>
  </section>;
}
