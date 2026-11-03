"use client";
/** PAP-1356 / PAP-1097: Core-owned 8-slot Loadout. No local inventory/Set writes or fake media. */
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { ModuleRow } from "@/lib/workspace-schema";
import type { SelfFields } from "./schema";

type Row = ModuleRow<SelfFields>;
const SLOTS = ["AURA_GROUND","AURA_BACK","BACK","OUTFIT","HAIR","FACE","HEADWEAR","PATH_MARK"] as const;
type Slot = typeof SLOTS[number];
type ItemSnapshot = { itemId:string; slot:Slot; displayName:string; assetKey:string; assetMimeType:string; positionX:number; positionY:number; scale:number; rotationDegrees:number|null };
type Loadout = { selfId:string; version:number; ready:boolean; slots:Record<Slot,ItemSnapshot|null>; renderStack:readonly string[]; updatedAt:string|null };
type Owned = { itemId:string; key:string; displayName:string; slot:string|null; itemStatus:string; ownership:{status:string} };
const LABELS:Record<Slot,string> = { AURA_GROUND:"Hào quang nền",AURA_BACK:"Hào quang sau",BACK:"Cánh / Phụ kiện sau",OUTFIT:"Trang phục",HAIR:"Tóc",FACE:"Gương mặt",HEADWEAR:"Phụ kiện đầu",PATH_MARK:"Dấu hành trình" };
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Slots=Record<Slot,string|null>;
const slotIds=(r:Loadout):Slots=>Object.fromEntries(SLOTS.map(slot=>[slot,r.slots[slot]?.itemId??null])) as Slots;
function parseLoadout(raw:unknown,selfId:string):Loadout {
  const data=(raw as {data?:unknown})?.data as Loadout|undefined;
  if(!data || data.selfId!==selfId || !Number.isSafeInteger(data.version) || data.version<0 || !data.slots || SLOTS.some(s=>data.slots[s]!==null && (!data.slots[s] || !UUID.test(data.slots[s]!.itemId)))) throw Error("Core trả về Loadout không hợp lệ.");
  return data;
}
export function SelfLoadoutDetail({row,centerId,activeTab,canView,canManage,canViewItems,onSaved}:{
  row:Row;centerId:string;activeTab:string;canView:boolean;canManage:boolean;canViewItems:boolean;onSaved:()=>void;
}) {
  const selfId=typeof row.pinoriaSelfId==="string" && UUID.test(row.pinoriaSelfId)?row.pinoriaSelfId:null;
  const [loadout,setLoadout]=useState<Loadout|null>(null);
  const [owned,setOwned]=useState<Owned[]>([]);
  const [chosen,setChosen]=useState<Slots|null>(null);
  const [reason,setReason]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [loading,setLoading]=useState(false);
  const [saving,setSaving]=useState(false);
  const [refresh,setRefresh]=useState(0);
  useEffect(()=>{
    if(activeTab!=="loadout" || !selfId || !canView) return;
    const ctl=new AbortController();
    queueMicrotask(()=>{if(!ctl.signal.aborted){setLoading(true);setError("");}});
    const base="/api/bo/pinoria/selfs/"+selfId;
    const qs="?centerId="+encodeURIComponent(centerId);
    const load=(url:string)=>fetch(url,{credentials:"include",cache:"no-store",signal:ctl.signal}).then(async r=>{
      if(!r.ok)throw Error(r.status===403?"Không có quyền ở cơ sở này.":"Core trả về "+r.status);return r.json() as Promise<unknown>;
    });
    void Promise.all([load(base+"/loadout"+qs), ...(canViewItems?[load(base+"/items"+qs)]:[])]).then(parts=>{
      if(ctl.signal.aborted)return;
      const next=parseLoadout(parts[0],selfId);
      const items=parts[1] as {data?:{selfId:string;items:Owned[]}}|undefined;
      if(canViewItems && (!items?.data || items.data.selfId!==selfId || !Array.isArray(items.data.items)))throw Error("Core trả về Item không hợp lệ.");
      setLoadout(next);setChosen(slotIds(next));setOwned(items?.data?.items??[]);
    }).catch(e=>{if(!ctl.signal.aborted)setError(e instanceof Error?e.message:"Không tải được Loadout.");})
      .finally(()=>{if(!ctl.signal.aborted)setLoading(false);});
    return ()=>ctl.abort();
  },[activeTab,selfId,centerId,canView,canViewItems,refresh]);
  const dirty=useMemo(()=>!!chosen && !!loadout && SLOTS.some(s=>chosen[s]!==loadout.slots[s]?.itemId && !(chosen[s]===null && loadout.slots[s]===null)),[chosen,loadout]);
  const options=useMemo(()=>SLOTS.map(slot=>({slot,items:owned.filter(i=>i.slot===slot && i.ownership.status==="ACTIVE" && i.itemStatus==="PUBLISHED")})),[owned]);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!selfId || !loadout || !chosen || !canManage || !canViewItems || !dirty || !reason.trim() || saving)return;
    setSaving(true);setError("");setNotice("");
    try{
      const response=await fetch("/api/bo/pinoria/selfs/"+selfId+"/loadout?centerId="+encodeURIComponent(centerId),{
        method:"POST",credentials:"include",cache:"no-store",
        headers:{"content-type":"application/json","idempotency-key":crypto.randomUUID()},
        body:JSON.stringify({expectedVersion:loadout.version,itemIdsBySlot:chosen,reason:reason.trim()}),
      });
      if(!response.ok)throw Error(response.status===409?"Loadout đã thay đổi. Hãy tải lại trước khi lưu.":response.status===403?"Không có quyền sửa Loadout.":"Core từ chối SaveSlots ("+response.status+").");
      const next=parseLoadout(await response.json(),selfId);
      setLoadout(next);setChosen(slotIds(next));setReason("");setNotice("Đã lưu Loadout phiên bản "+next.version+".");onSaved();
    }catch(e){setError(e instanceof Error?e.message:"Lỗi SaveSlots.");setRefresh(n=>n+1);}
    finally{setSaving(false);}
  }
  if(activeTab!=="loadout")return null;
  if(!selfId)return <p role="status">Person chưa có Self; không thể chỉnh Loadout.</p>;
  if(!canView)return <p role="alert">Bạn chưa được cấp quyền xem Loadout.</p>;
  return <section className="grid-card" aria-label="Pinoria Self Loadout">
    <h3>Composition Preview</h3>
    <figure className="grid-card">
      <img src="https://assets.pinohouse.art/pinoria/char-base.png" alt="Nền nhân vật Pinoria — khung dọc 9:16" width="216" height="384"/>
      <figcaption>Ảnh Item riêng tư chưa được hiển thị: chờ Core BO media contract PAP-1428. Không sử dụng ảnh giả.</figcaption>
    </figure>
    <p role="note">Set phủ toàn bộ Self là trạng thái độc lập thuộc S6; SaveSlots không thay đổi Set.</p>
    <label htmlFor="self-loadout-set">Set</label>
    <select id="self-loadout-set" disabled value="separate"><option value="separate">S6 — chưa bật quản lý Set</option></select>
    {loading && <p role="status">Đang tải Loadout từ Core…</p>}
    {error && <p role="alert" className="error">{error} <button type="button" onClick={()=>setRefresh(n=>n+1)}>Tải lại</button></p>}
    {notice && <p role="status">{notice}</p>}
    {loadout && chosen && !loading && <form className="grid-card" onSubmit={e=>{void submit(e);}}>
      <p>Phiên bản {loadout.version} · {loadout.ready?"READY":"Chưa đủ Tóc + Mặt + Trang phục"} · {loadout.updatedAt??"Chưa lưu"}</p>
      {options.map(({slot,items})=>{
        const current=loadout.slots[slot];
        const currentValue=chosen[slot]??"";
        return <div className="property-control" key={slot}>
          <label htmlFor={"self-loadout-"+slot}>{LABELS[slot]}</label>
          <select id={"self-loadout-"+slot} value={currentValue} disabled={!canManage||!canViewItems||saving}
            onChange={e=>setChosen(prev=>prev?{...prev,[slot]:e.target.value||null}:prev)}>
            <option value="">Không trang bị</option>
            {current && !items.some(item=>item.itemId===current.itemId) && <option value={current.itemId}>{current.displayName} (lịch sử)</option>}
            {items.map(item=><option key={item.itemId} value={item.itemId}>{item.displayName}</option>)}
          </select>
        </div>;
      })}
      {!canViewItems && <p role="alert">Thiếu quyền xem Item để lựa chọn trang bị.</p>}
      <label htmlFor="self-loadout-reason">Lý do lưu *</label>
      <textarea id="self-loadout-reason" maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)} disabled={!canManage||saving}/>
      <div className="toolbar">
        <button type="button" className="secondary-btn" onClick={()=>setChosen(slotIds(loadout))} disabled={!dirty||saving}>Hoàn tác</button>
        <button type="submit" className="primary-btn" disabled={!dirty||!canManage||!canViewItems||!reason.trim()||saving}>{saving?"Đang lưu…":"Lưu trang bị"}</button>
      </div>
    </form>}
  </section>;
}
