"use client";
// PAP-1625 / PNR-WARD FG2: Core-backed Create Self via real Dsa DrawerFrame, no second shell.
import { useEffect, useState } from "react";
import { BoActionButton } from "@pino/design-system/react";
import { DrawerFrame } from "@/app/components/workspace-renderer/DrawerFrame";

type Candidate={personId:string;pinoriaSelfId?:string|null;displayName:string;avatarStatus:string;subjectStatus:string;subjectTypes:string[]};
type DirectoryPage={items:Candidate[];nextCursor:string|null};
const canonical=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function errorFor(status:number):string{
 if(status===401)return "Phiên đăng nhập đã hết hạn.";
 if(status===403)return "Bạn không có quyền tạo Self tại cơ sở đang chọn.";
 if(status===404)return "Person không còn đủ điều kiện tại cơ sở này.";
 if(status===409)return "Person này đã có Self. Tải lại danh sách để kiểm tra.";
 return "Không thể xác nhận kết quả. Hãy kiểm tra lại danh sách trước khi thử lại.";
}
export function CreateSelfDrawer({centerId,onClose,onCreated}:{centerId:string;onClose:()=>void;onCreated:()=>void}){
 const [query,setQuery]=useState("");
 const [candidates,setCandidates]=useState<Candidate[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [personId,setPersonId]=useState("");
 const [saving,setSaving]=useState(false);
 const [nickname,setNickname]=useState("");
 const [duplicateConflict,setDuplicateConflict]=useState(false);
 useEffect(()=>{
  const ctl=new AbortController();
  setCandidates([]);setPersonId("");setDuplicateConflict(false);setLoading(true);setError("");
  void (async()=>{
   try{
    let cursor:string|null=null;
    const entries:Candidate[]=[];const seen=new Set<string>();
    // Bounded pagination, no name/email identity inference or cross-Center fallback.
    for(let n=0;n<10;n++){
     const qs=new URLSearchParams({centerId,limit:"100",...(query.trim()?{q:query.trim()}:{}),...(cursor?{cursor}:{})});
     const r=await fetch("/api/bo/pinoria/avatars?"+qs.toString(),{signal:ctl.signal,cache:"no-store"});
     if(!r.ok)throw Error(errorFor(r.status));
     const body:unknown=await r.json();
     if(!body||typeof body!=="object"||!("data" in body))throw Error("Danh sách Person không hợp lệ.");
     const data=(body as {data:DirectoryPage}).data;
     if(!Array.isArray(data.items)||!(data.nextCursor===null||typeof data.nextCursor==="string"))throw Error("Danh sách Person không hợp lệ.");
     for(const raw of data.items){
      if(!raw||typeof raw!=="object"||!canonical.test(raw.personId)||
        !["ACTIVE","MIXED"].includes(raw.subjectStatus)||typeof raw.displayName!=="string"||
        seen.has(raw.personId))continue;
      seen.add(raw.personId);entries.push(raw);
     }
     cursor=data.nextCursor;if(!cursor)break;
    }
    if(!ctl.signal.aborted)setCandidates(entries);
   }catch(e){
    if(!ctl.signal.aborted)setError(e instanceof Error?e.message:"Không tải được Person.");
   }finally{if(!ctl.signal.aborted)setLoading(false)}
  })();
  return()=>ctl.abort();
 },[centerId,query]);
 const selected=candidates.find(p=>p.personId===personId);
 const duplicate=!!personId && (duplicateConflict || !!selected?.pinoriaSelfId || selected?.avatarStatus!=="SELF_MISSING");
 async function create(){
  if(!personId||!selected||duplicate){if(!duplicate)setError("Vui lòng chọn Person đủ điều kiện.");return}
  if(saving)return;
  setSaving(true);setError("");
  try{
   const r=await fetch("/api/bo/pinoria/avatars?"+new URLSearchParams({centerId}),{
    method:"POST",headers:{"content-type":"application/json"},credentials:"same-origin",
    body:JSON.stringify({personId,...(nickname.trim()?{nickname:nickname.trim()}:{} )}),cache:"no-store"
   });
   if(r.status===409){setDuplicateConflict(true);setError("");return}
   if(r.status!==201){setError(errorFor(r.status));return}
   const response:unknown=await r.json();
   const data=response&&typeof response==="object"&&"data" in response?(response as {data?:{id?:unknown,personId?:unknown}}).data:null;
   if(!data||typeof data.id!=="string"||data.personId!==personId)throw Error("Chưa xác nhận được Self vừa tạo.");
   onCreated();
  }catch(e){setError(e instanceof Error?e.message:"Không thể xác nhận thao tác.")}
  finally{setSaving(false)}
 }
 return <DrawerFrame title="Tạo Self" path="Pinoria · Self" onClose={onClose}
  footer={<>
   <BoActionButton type="button" variant="secondary" onClick={onClose} disabled={saving}>Hủy</BoActionButton>
   <BoActionButton type="button" variant="primary" onClick={()=>void create()} disabled={saving||loading||duplicate||!!error&&candidates.length===0||!personId}>
    {duplicate?"Đã có Self":saving?"Đang tạo…":"Tạo Self"}
   </BoActionButton>
  </>}>
  <section className="property-section" aria-label="Thông tin Self">
   <h3>Thông tin Self</h3>
   <div className="property-row">
    <label className="property-label" htmlFor="ps-create-person">Person *</label>
    <div className="property-control">
     <select id="ps-create-person" value={personId} onChange={e=>{setPersonId(e.target.value);setDuplicateConflict(false);setError("")}}
      required disabled={loading||saving||!candidates.length} aria-describedby="ps-create-person-hint">
      <option value="">— Chọn Person —</option>
      {candidates.map(p=><option key={p.personId} value={p.personId}>{p.displayName} · {p.subjectTypes.join(" / ")}</option>)}
     </select>
    </div>
   </div>
   <p id="ps-create-person-hint" role="status">{loading?"Đang tìm Person tại cơ sở đã chọn…":
    candidates.length?"Học viên đã có Self vẫn có thể được chọn để nhận biết trùng ngay ở nút Tạo.":"Không có Person phù hợp tại cơ sở này."}</p>
   <div className="property-row"><label className="property-label" htmlFor="ps-create-nickname">Nickname của Self</label>
    <div className="property-control"><input id="ps-create-nickname" type="text" value={nickname} maxLength={40} autoComplete="off"
     onChange={e=>{setNickname(e.target.value);setError("")}} placeholder="Tên hiển thị của Self (không bắt buộc)" disabled={saving}/></div>
   </div>
   <p>Nickname thuộc Self, không đổi tên học viên. Self được tạo riêng; không tự cấp Starter Set hay trang bị Item.</p>
   <div className="property-row"><span className="property-label">Self ID</span><span className="property-control">—</span></div>
  </section>
  <section className="property-section" aria-label="Thông tin hệ thống">
   <h3>Thông tin hệ thống</h3>
   {["Created Time","Created by (User)","Last Modified Time","Last Modified By (User)"].map(label=>
    <div className="property-row" key={label}><span className="property-label">{label}</span><span className="property-control">—</span></div>)}
  </section>
  <div className="property-row"><label className="property-label" htmlFor="ps-create-search">Tìm Person</label>
   <input id="ps-create-search" className="property-control" value={query} onChange={e=>setQuery(e.target.value)} maxLength={120} placeholder="Nhập tên để tìm" disabled={saving}/></div>
  {error?<p role="alert">{error}</p>:null}
 </DrawerFrame>;
}
