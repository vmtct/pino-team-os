"use client";
import { useEffect, useRef, useState } from "react";
import { DrawerFrame } from "@/app/components/workspace-renderer/DrawerFrame";
import { clientTerm, loadGlobalTerm, termRequest } from "@/lib/ho-global-terms-client";
import { object, parseTermCommand, type GlobalTermDetail } from "@/lib/ho-global-terms-contract";

export function HoGlobalTermEditor({ action, id, fetcher, onClose, onSaved }: {action:"create"|"update"|"delete";id?:string;fetcher:typeof fetch;onClose:()=>void;onSaved:()=>void}) {
  const [term,setTerm]=useState<GlobalTermDetail|null>(null),[loading,setLoading]=useState(action!=="create"),[error,setError]=useState("");
  const [name,setName]=useState(""),[code,setCode]=useState(""),[start,setStart]=useState(""),[end,setEnd]=useState(""),[busy,setBusy]=useState(false),[reload,setReload]=useState(0),[stale,setStale]=useState(false);
  const replay=useRef<{body:string;key:string}|null>(null);
  const lifetime=useRef<AbortController|null>(null);
  useEffect(()=>{const controller=new AbortController();lifetime.current=controller;return()=>controller.abort();},[]);
  useEffect(()=>{
    if(action==="create"||!id)return;
    const controller=new AbortController();
    void loadGlobalTerm(id,fetcher,controller.signal).then(t=>{setTerm(t);setName(t.name);setCode(t.code);setStart(t.startDate);setEnd(t.endDate);setLoading(false);setStale(false);}).catch(e=>{if(!controller.signal.aborted){setError(e instanceof Error?e.message:"Không thể tải Global Term.");setLoading(false);}});
    return()=>controller.abort();
  },[action,id,fetcher,reload]);
  const close=()=>{if(!busy)onClose();};
  async function save(){
    if(busy||loading||stale||action!=="create"&&!term)return;
    if(action==="delete"&&term!.weekCount>0){setError("Không được xóa Term đã có tuần.");return;}
    const input=action==="create"?{displayName:name.trim(),code:code.trim(),startDate:start,endDate:end}:action==="update"?{displayName:name.trim(),expectedUpdatedAt:term!.updatedAt}:{expectedUpdatedAt:term!.updatedAt};
    if(!parseTermCommand(input,action)){setError("Nhập tên, mã và khoảng ngày hợp lệ.");return;}
    const body=JSON.stringify(input);
    if(replay.current?.body!==body)replay.current={body,key:crypto.randomUUID()};
    setBusy(true);setError("");
    try {
      const data=await termRequest(action==="create"?"":"/"+id+"/"+action,{method:"POST",headers:{"content-type":"application/json","idempotency-key":replay.current!.key},body,signal:lifetime.current?.signal},fetcher);
      if(action==="delete") {if(object(data)?.termId!==id||object(data)?.deleted!==true)throw Error("Core chưa xác nhận xóa.");}
      else {const saved=clientTerm(data,true);if(action==="update"&&saved.id!==id||saved.name!==input.displayName||action==="update"&&saved.updatedAt===term!.updatedAt)throw Error("Core chưa xác nhận lưu.");}
      onSaved();
    } catch(e){if(lifetime.current?.signal.aborted)return;setError(e instanceof Error?e.message:"Chưa xác minh được kết quả; tải lại trước khi thử lại.");setStale(true);}
    finally{setBusy(false);}
  }
  return <DrawerFrame title={action==="create"?"Tạo Global Term":action==="update"?"Chỉnh sửa Global Term":"Xác nhận xóa Global Term"} path="Operating Cycle · Global Terms" onClose={close}
    footer={<><button type="button" className="secondary-btn" disabled={busy} onClick={close}>Hủy</button><button type="button" className="primary-btn" disabled={busy||loading||stale||action!=="create"&&!term||action==="delete"&&!!term?.weekCount} onClick={()=>void save()}>{busy?"Đang xác minh…":action==="delete"?"Xác nhận xóa":"Lưu vào Core"}</button></>}>
    {loading?<p role="status">Đang tải Global Term…</p>:action==="delete"?<p>Chỉ xóa khi Core xác nhận không có tuần hoặc dữ liệu tham chiếu. Không xóa dây chuyền.{term?.weekCount?" Term đã có tuần; không thể xóa.":""}</p>:<section className="property-section">
      <div className="property-row"><label htmlFor="global-term-name">Tên học kỳ *</label><input className="edit-input" id="global-term-name" maxLength={160} value={name} disabled={busy||stale} onChange={e=>setName(e.target.value)}/></div>
      <div className="property-row"><label htmlFor="global-term-code">Mã *</label><input className="edit-input" id="global-term-code" maxLength={96} value={code} disabled={action!=="create"||busy||stale} onChange={e=>setCode(e.target.value)}/></div>
      <div className="property-row"><label htmlFor="global-term-start">Bắt đầu *</label><input className="edit-input" id="global-term-start" type="date" value={start} disabled={action!=="create"||busy||stale} onChange={e=>setStart(e.target.value)}/></div>
      <div className="property-row"><label htmlFor="global-term-end">Kết thúc *</label><input className="edit-input" id="global-term-end" type="date" min={start||undefined} value={end} disabled={action!=="create"||busy||stale} onChange={e=>setEnd(e.target.value)}/></div>
      <p className="settings-hint">GLOBAL cố định. Không chọn Center.{action==="update"?" Chỉ sửa tên; Core chưa cung cấp xác nhận an toàn để sửa mã/ngày.":""}</p>
    </section>}
    {error&&<p role="alert">{error}</p>}
    {(error||stale)&&action!=="create"&&<button type="button" disabled={busy} onClick={()=>{setLoading(true);setError("");setReload(n=>n+1);}}>Tải lại từ Core</button>}
    {stale&&action==="create"&&<p role="status">Đóng và tải lại danh sách để kiểm tra kết quả trước khi tạo lại.</p>}
  </DrawerFrame>;
}
