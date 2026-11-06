"use client";
/** PAP-1356 / PAP-1456 / Epic PAP-1097: Core-owned 8-slot Loadout; DS UI and draft-safe save. */
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { ModuleRow } from "@/lib/workspace-schema";
import type { SelfFields } from "./schema";
import { SelfLoadoutPreview, SelfLoadoutEditorLayout } from "@/app/components/pinoria/SelfLoadoutPreview";

type Row = ModuleRow<SelfFields>;
const SLOTS = ["AURA_GROUND","AURA_BACK","BACK","OUTFIT","HAIR","FACE","HEADWEAR","PATH_MARK"] as const;
type Slot = typeof SLOTS[number];
type ItemSnapshot = { itemId:string; slot:Slot; displayName:string; assetKey:string; assetMimeType:string; positionX:number; positionY:number; scale:number; rotationDegrees:number|null };
type Loadout = { selfId:string; version:number; ready:boolean; slots:Record<Slot,ItemSnapshot|null>; renderStack:readonly string[]; updatedAt:string|null };
type EligibleSet = { setItemId:string; displayName:string; membershipRevision:number; memberCount:number };
type SelfSet = { selfId:string; selfVersion:number; version:number; setItemId:string|null; membershipRevision:number|null; members:{itemId:string;slot:string;displayName:string;positionX:number;positionY:number;scale:number;rotationDegrees:number|null}[]; ready:boolean; eligibleSets:EligibleSet[]; starterAvailable:boolean; starterSets:EligibleSet[] };
function parseSet(raw:unknown,selfId:string):SelfSet {
  const d=(raw as {data?:SelfSet})?.data;
  if(!d || d.selfId!==selfId || !Number.isSafeInteger(d.version) || d.version<0 || !Number.isSafeInteger(d.selfVersion) || d.selfVersion<1 || typeof d.ready!=="boolean" || typeof d.starterAvailable!=="boolean" || !Array.isArray(d.starterSets) || (d.starterAvailable !== (d.starterSets.length > 0)) || d.starterSets.some(s=>!s || !UUID.test(s.setItemId) || typeof s.displayName!=="string" || !s.displayName.trim() || !Number.isSafeInteger(s.membershipRevision) || s.membershipRevision<1 || !Number.isSafeInteger(s.memberCount) || s.memberCount<1 || s.memberCount>8) || new Set(d.starterSets.map(s=>s.setItemId)).size!==d.starterSets.length || (d.setItemId!==null && !UUID.test(d.setItemId)) || !Array.isArray(d.members) || d.members.some(m=>!m || !UUID.test(m.itemId) || !SLOTS.includes(m.slot as Slot) || (d.setItemId!==null && (typeof m.displayName!=="string" || !Number.isFinite(m.positionX) || !Number.isFinite(m.positionY) || !Number.isFinite(m.scale) || m.scale<=0 || m.scale>10 || (m.rotationDegrees!==null && !Number.isFinite(m.rotationDegrees))))) || !Array.isArray(d.eligibleSets) || d.eligibleSets.some(s=>!s || !UUID.test(s.setItemId) || typeof s.displayName!=="string" || !s.displayName.trim() || !Number.isSafeInteger(s.membershipRevision) || s.membershipRevision<1 || !Number.isSafeInteger(s.memberCount) || s.memberCount<1 || s.memberCount>8) || new Set(d.eligibleSets.map(s=>s.setItemId)).size!==d.eligibleSets.length) throw Error("Invalid Set state.");
  return d;
}
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
  // null means unavailable, never an authorized empty inventory.
  const [selfSet,setSelfSet]=useState<SelfSet|null>(null);
  const [selectedSetId,setSelectedSetId]=useState("");
  const [selectedStarterId,setSelectedStarterId]=useState("");
  const [activeSetError,setActiveSetError]=useState("");
  const [activeSetReason,setActiveSetReason]=useState("");
  const [activeSetConflict,setActiveSetConflict]=useState(false);
  const [owned,setOwned]=useState<Owned[]|null>(null);
  const [itemError,setItemError]=useState("");
  const [conflict,setConflict]=useState(false);
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
    queueMicrotask(()=>{if(!ctl.signal.aborted){setSelfSet(null);setSelectedSetId("");setSelectedStarterId("");setActiveSetError("");setActiveSetReason("");setActiveSetConflict(false);setLoading(true);setError("");setItemError("");setOwned(null);setLoadout(null);setChosen(null);setReason("");setNotice("");setConflict(false);}});
    const base="/api/bo/pinoria/selfs/"+selfId;
    const qs="?centerId="+encodeURIComponent(centerId);
    const load=(url:string)=>fetch(url,{credentials:"include",cache:"no-store",signal:ctl.signal}).then(async r=>{
      if(!r.ok)throw Error(r.status===403?"Không có quyền ở cơ sở này.":"Core trả về "+r.status);return r.json() as Promise<unknown>;
    });
    const readSet=load(base+"/set"+qs).then(raw=>{if(!ctl.signal.aborted)setSelfSet(parseSet(raw,selfId));}).catch(()=>{if(!ctl.signal.aborted)setActiveSetError("Không tải được trạng thái Set. Hãy tải lại.");});
    const readLoadout=load(base+"/loadout"+qs).then(raw=>{
      if(ctl.signal.aborted)return;
      const next=parseLoadout(raw,selfId);
      setLoadout(next);setChosen(slotIds(next));
    }).catch(e=>{if(!ctl.signal.aborted)setError(e instanceof Error?e.message:"Không tải được Loadout.");});
    const readItems=canViewItems?load(base+"/items"+qs).then(raw=>{
      if(ctl.signal.aborted)return;
      const items=raw as {data?:{selfId:string;items:Owned[]}};
      if(!items?.data || items.data.selfId!==selfId || !Array.isArray(items.data.items) || items.data.items.some(i=>!i || !UUID.test(i.itemId) || !i.ownership || typeof i.displayName!=="string"))throw Error("Core trả về Item không hợp lệ.");
      setOwned(items.data.items);
    }).catch(()=>{if(!ctl.signal.aborted)setItemError("Không tải được danh sách Item được phép sử dụng. Chỉ xem Loadout đã lưu; hãy tải lại để thử lại.");}):Promise.resolve();
    void Promise.all([readLoadout,readItems,readSet]).finally(()=>{if(!ctl.signal.aborted)setLoading(false);});
    return ()=>ctl.abort();
  },[activeTab,selfId,centerId,canView,canViewItems,refresh]);
  const dirty=useMemo(()=>!!chosen && !!loadout && SLOTS.some(s=>chosen[s]!==loadout.slots[s]?.itemId && !(chosen[s]===null && loadout.slots[s]===null)),[chosen,loadout]);
  const options=useMemo(()=>SLOTS.map(slot=>({slot,items:(owned??[]).filter(i=>i.slot===slot && i.ownership.status==="ACTIVE" && i.itemStatus==="PUBLISHED")})),[owned]);
  const inventoryReady=canViewItems && owned!==null;
  const canEdit=canManage && inventoryReady && !loading && !saving && !conflict;
  const validSelection=!!chosen && options.every(({slot,items})=>chosen[slot]===null || items.some(i=>i.itemId===chosen[slot] && UUID.test(i.itemId)));
  const mediaSrc=useCallback((slot:Slot)=>"/api/bo/pinoria/selfs/"+selfId+"/loadout/media/"+slot+"?centerId="+encodeURIComponent(centerId),[selfId,centerId]);
  const setMemberSrc=useCallback((index:number)=>"/api/bo/pinoria/selfs/"+selfId+"/set/media/"+index+"?centerId="+encodeURIComponent(centerId),[selfId,centerId]);
  function resetDraft(){
    if(!loadout)return;
    setChosen(slotIds(loadout));setReason("");setNotice("");
    if(!conflict)setError("");
  }
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!selfId || !loadout || !chosen || !canEdit || !validSelection || !dirty || !reason.trim())return;
    setSaving(true);setError("");setNotice("");
    try{
      const response=await fetch("/api/bo/pinoria/selfs/"+selfId+"/loadout?centerId="+encodeURIComponent(centerId),{
        method:"POST",credentials:"include",cache:"no-store",
        headers:{"content-type":"application/json","idempotency-key":crypto.randomUUID()},
        body:JSON.stringify({expectedVersion:loadout.version,itemIdsBySlot:chosen,reason:reason.trim()}),
      });
      if(!response.ok){
        if(response.status===409)setConflict(true);
        throw Error(response.status===409?"Loadout đã thay đổi. Bản nháp và lý do được giữ lại. Sao chép nội dung cần giữ trước khi chọn bỏ bản nháp và tải lại.":response.status===403?"Không có quyền sửa Loadout tại cơ sở này. Bản nháp được giữ lại; hãy kiểm tra quyền trước khi thử lại.":"Không lưu được trang bị ("+response.status+"). Bản nháp được giữ lại; hãy thử lại hoặc tải lại trạng thái đã lưu.");
      }
      const next=parseLoadout(await response.json(),selfId);
      setLoadout(next);setChosen(slotIds(next));setReason("");setNotice("Đã lưu Loadout phiên bản "+next.version+".");onSaved();
    }catch(e){setError(e instanceof TypeError?"Không xác nhận được kết quả lưu do lỗi kết nối. Bản nháp được giữ lại; hãy kiểm tra kết nối và thử lại hoặc tải lại trạng thái đã lưu.":e instanceof Error?e.message:"Không xác nhận được kết quả lưu. Bản nháp được giữ lại; hãy thử lại hoặc tải lại trạng thái đã lưu.");}
    finally{setSaving(false);}
  }
  async function startSet(){
    const choice=selfSet?.starterSets.find(s=>s.setItemId===selectedStarterId);
    if(!selfId || !selfSet?.starterAvailable || !choice || !canManage || loading || saving || activeSetConflict || !activeSetReason.trim())return;
    setSaving(true);setActiveSetError("");setNotice("");
    try {
      const response=await fetch("/api/bo/pinoria/selfs/"+selfId+"/set/starter?centerId="+encodeURIComponent(centerId),{
        method:"POST",credentials:"include",cache:"no-store",
        headers:{"content-type":"application/json","idempotency-key":crypto.randomUUID()},
        body:JSON.stringify({setItemId:choice.setItemId,expectedVersion:selfSet.version,expectedSelfVersion:selfSet.selfVersion,reason:activeSetReason.trim()}),
      });
      if(!response.ok){
        if(response.status===409)setActiveSetConflict(true);
        throw Error(response.status===409?"Starter đã được nhận hoặc trạng thái đã thay đổi. Giữ lựa chọn và tải lại trước khi thử tiếp.":response.status===403?"Không có quyền nhận Starter tại cơ sở này.":"Không xác nhận được kết quả Starter. Hãy kiểm tra trạng thái đã lưu.");
      }
      const read=await fetch("/api/bo/pinoria/selfs/"+selfId+"/set?centerId="+encodeURIComponent(centerId),{credentials:"include",cache:"no-store"});
      if(!read.ok)throw Error("Chưa xác minh được Starter đã lưu. Tải lại để kiểm tra.");
      const next=parseSet(await read.json(),selfId);
      if(next.setItemId!==choice.setItemId || next.starterAvailable || next.selfVersion<=selfSet.selfVersion)throw Error("Trạng thái Starter chưa khớp. Tải lại để kiểm tra.");
      setSelfSet(next);setSelectedStarterId("");setActiveSetReason("");setNotice("Đã nhận Starter và áp dụng Set.");onSaved();
    }catch(e){setActiveSetError(e instanceof Error?e.message:"Chưa xác nhận được Starter. Hãy tải lại.");}
    finally{setSaving(false);}
  }
  async function applySet(){
    const option=selfSet?.eligibleSets.find(s=>s.setItemId===selectedSetId);
    if(!selfId || !selfSet || !option || option.setItemId===selfSet.setItemId || !canManage || loading || saving || activeSetConflict || !activeSetReason.trim())return;
    const requestedSetId=option.setItemId;
    setSaving(true);setActiveSetError("");setNotice("");
    try {
      const response=await fetch("/api/bo/pinoria/selfs/"+selfId+"/set/apply?centerId="+encodeURIComponent(centerId),{
        method:"POST",credentials:"include",cache:"no-store",
        headers:{"content-type":"application/json","idempotency-key":crypto.randomUUID()},
        body:JSON.stringify({setItemId:requestedSetId,expectedVersion:selfSet.version,expectedSelfVersion:selfSet.selfVersion,reason:activeSetReason.trim()}),
      });
      if(!response.ok){if(response.status===409)setActiveSetConflict(true);throw Error(response.status===409?"Set đã thay đổi hoặc chưa đủ điều kiện. Giữ bản nháp và tải lại trước khi thử tiếp.":"Không xác nhận được kết quả Apply Set. Giữ bản nháp để kiểm tra.");}
      const read=await fetch("/api/bo/pinoria/selfs/"+selfId+"/set?centerId="+encodeURIComponent(centerId),{credentials:"include",cache:"no-store"});
      if(!read.ok)throw Error("Chưa xác nhận được Set đã lưu. Hãy tải lại trước khi thử tiếp.");
      const next=parseSet(await read.json(),selfId);
      if(next.setItemId!==requestedSetId)throw Error("Set đã lưu khác lựa chọn. Tải lại để kiểm tra.");
      setSelfSet(next);setSelectedSetId("");setActiveSetReason("");setNotice("Đã áp dụng Set.");onSaved();
    }catch(e){setActiveSetError(e instanceof Error?e.message:"Không xác nhận được kết quả. Hãy tải lại.");}
    finally{setSaving(false);}
  }
  async function clearSet(){
    if(!selfId || !selfSet?.setItemId || !canManage || loading || saving || activeSetConflict || !activeSetReason.trim())return;
    setSaving(true);setActiveSetError("");setNotice("");
    try {
      const response=await fetch("/api/bo/pinoria/selfs/"+selfId+"/set/clear?centerId="+encodeURIComponent(centerId),{
        method:"POST",credentials:"include",cache:"no-store",
        headers:{"content-type":"application/json","idempotency-key":crypto.randomUUID()},
        body:JSON.stringify({expectedVersion:selfSet.version,expectedSelfVersion:selfSet.selfVersion,reason:activeSetReason.trim()}),
      });
      if(!response.ok){if(response.status===409)setActiveSetConflict(true);throw Error(response.status===409?"Set đã thay đổi. Giữ nguyên lý do và tải lại trước khi thử tiếp.":"Không xác nhận được kết quả. Lý do và trạng thái đang xem được giữ nguyên.");}
      // Command receipts are not GET projections; confirm persisted state by reading Core.
      const read=await fetch("/api/bo/pinoria/selfs/"+selfId+"/set?centerId="+encodeURIComponent(centerId),{credentials:"include",cache:"no-store"});
      if(!read.ok)throw Error("Chưa xác nhận được trạng thái đã lưu. Hãy tải lại để kiểm tra.");
      const next=parseSet(await read.json(),selfId);
      setSelfSet(next);setActiveSetReason("");setNotice(next.setItemId?"Trạng thái Set đã cập nhật.":"Đã bỏ Set.");onSaved();
    }catch(e){setActiveSetError(e instanceof Error?e.message:"Không xác nhận được kết quả. Lý do và trạng thái đang xem được giữ nguyên.");}
    finally{setSaving(false);}
  }
  if(activeTab!=="loadout")return null;
  if(!selfId)return <p role="status">Person chưa có Self; không thể chỉnh Loadout.</p>;
  if(!canView)return <p role="alert">Bạn chưa được cấp quyền xem Loadout.</p>;
  return <section aria-label="Pinoria Self Loadout">
    <SelfLoadoutEditorLayout preview={<SelfLoadoutPreview key={selfId+":"+(loadout?.version??"loading")+":"+(selfSet?.version??"pending")} loadout={selfSet && !selfSet.setItemId?loadout:null}
      activeSet={selfSet?.setItemId?selfSet:null} setMemberSrc={setMemberSrc} mediaSrc={mediaSrc}/> }>
    <h3 className="pds-property-heading">Trang bị Self</h3>
    <p id="self-loadout-help" role="note" className="pds-property-text">Preview chỉ hiển thị trang bị đã lưu; lựa chọn bên dưới chưa được áp dụng cho đến khi lưu. Set được áp dụng riêng, không thay đổi tám ô trang bị đã lưu.</p>
    <div className="pds-property-row">
      <label className="pds-property-label" htmlFor="self-loadout-set">Set</label>
      <select id="self-loadout-set" className="pds-property-input" value={selectedSetId} disabled={!canManage||!selfSet||loading||saving||activeSetConflict||selfSet.eligibleSets.length===0}
        onChange={e=>{setSelectedSetId(e.target.value);setActiveSetError("");}}>
        <option value="">Chọn Set đã sở hữu đầy đủ trang bị</option>
        {selfSet?.eligibleSets.map(s=><option key={s.setItemId} value={s.setItemId}>{s.displayName}</option>)}
      </select>
    </div>
    {selfSet?.starterAvailable && <div className="pds-property-row">
      <label className="pds-property-label" htmlFor="self-loadout-starter">Bộ Starter lần đầu</label>
      <select id="self-loadout-starter" className="pds-property-input" value={selectedStarterId}
        disabled={!canManage||loading||saving||activeSetConflict}
        onChange={e=>{setSelectedStarterId(e.target.value);setActiveSetError("");}}>
        <option value="">Chọn bộ Starter</option>
        {selfSet.starterSets.map(s=><option key={s.setItemId} value={s.setItemId}>{s.displayName}</option>)}
      </select>
    </div>}
    {selfSet?.setItemId && <p role="status">Đang sử dụng Set {selfSet.eligibleSets.find(s=>s.setItemId===selfSet.setItemId)?.displayName??"đã lưu"}.</p>}
    {selfSet && selfSet.eligibleSets.length===0 && <p className="pds-property-text">Chưa có Set đủ điều kiện để áp dụng.</p>}
    {selfSet && <p role="status">{selfSet.ready?"Sẵn sàng":"Chưa sẵn sàng"} - Phiên bản Set {selfSet.version}</p>}
    {selfSet && (selfSet.eligibleSets.length>0 || selfSet.setItemId || selfSet.starterAvailable) && <>
      <div className="pds-property-row"><label className="pds-property-label" htmlFor="self-set-reason">Lý do thay đổi Set *</label>
        <textarea id="self-set-reason" className="pds-property-input" maxLength={1000} value={activeSetReason} disabled={!canManage||saving||loading||activeSetConflict} onChange={e=>setActiveSetReason(e.target.value)}/></div>
      <div className="pds-property-actions">
        <button type="button" disabled={!canManage||saving||loading||activeSetConflict||!activeSetReason.trim()||!selectedSetId||selectedSetId===selfSet.setItemId||!selfSet.eligibleSets.some(s=>s.setItemId===selectedSetId)} onClick={()=>{void applySet();}}>Áp dụng Set</button>
        {selfSet.starterAvailable && <button type="button"
          disabled={!canManage||saving||loading||activeSetConflict||!activeSetReason.trim()||!selectedStarterId||!selfSet.starterSets.some(s=>s.setItemId===selectedStarterId)}
          onClick={()=>{void startSet();}}>Nhận Starter</button>}
        {selfSet.setItemId && <button type="button" disabled={!canManage||saving||loading||activeSetConflict||!activeSetReason.trim()} onClick={()=>{void clearSet();}}>Bỏ Set</button>}
      </div>
    </>}
    {activeSetError && <p role="alert">{activeSetError}</p>}
    {activeSetError && <button type="button" disabled={loading||saving} onClick={()=>setRefresh(n=>n+1)}>Bỏ bản nháp và tải lại</button>}
    {loading && <p role="status">Đang tải Loadout từ Core…</p>}
    {error && <p role="alert" className="pds-property-text">{error}</p>}
    {itemError && <p role="alert" className="pds-property-text">{itemError}</p>}
    {(error||itemError) && <div className="pds-property-actions"><button type="button" disabled={loading||saving} onClick={()=>setRefresh(n=>n+1)}>{dirty||reason?"Bỏ bản nháp và tải lại":"Tải lại trạng thái đã lưu"}</button></div>}
    {notice && <p role="status">{notice}</p>}
    {loadout && chosen && !loading && <form aria-label="Thiết lập trang bị Self" aria-describedby="self-loadout-help self-loadout-state" onSubmit={e=>{void submit(e);}}>
      <p id="self-loadout-state" role="status" className="pds-property-text">{dirty?"Có thay đổi trang bị chưa lưu.":"Trang bị khớp với phiên bản đã lưu."}</p>
      {!canManage && <p className="pds-property-text">Chỉ xem: bạn chưa được cấp quyền sửa Loadout.</p>}
      <p>Phiên bản {loadout.version} · {selfSet?(selfSet.ready?"Sẵn sàng":"Chưa sẵn sàng"):"Chưa xác nhận trạng thái"} · {loadout.updatedAt??"Chưa lưu"}</p>
      {options.map(({slot,items})=>{
        const current=loadout.slots[slot];
        const currentValue=chosen[slot]??"";
        return <div className="pds-property-row" key={slot}>
          <label className="pds-property-label" htmlFor={"self-loadout-"+slot}>{LABELS[slot]}</label>
          <select className="pds-property-input" id={"self-loadout-"+slot} value={currentValue} disabled={!canEdit}
            onChange={e=>{setNotice("");setChosen(prev=>prev?{...prev,[slot]:e.target.value||null}:prev);}}>
            <option value="">Không trang bị</option>
            {current && !items.some(item=>item.itemId===current.itemId) && <option value={current.itemId}>{current.displayName} (lịch sử)</option>}
            {items.map(item=><option key={item.itemId} value={item.itemId}>{item.displayName}</option>)}
          </select>
        </div>;
      })}
      {!canViewItems && <p role="alert">Thiếu quyền xem Item để lựa chọn trang bị.</p>}
      {inventoryReady && !validSelection && <p role="alert" className="pds-property-text">Trang bị lịch sử không còn là Item hợp lệ. Chọn Item được phép sử dụng hoặc bỏ trang bị trước khi lưu.</p>}
      <div className="pds-property-row">
        <label className="pds-property-label" htmlFor="self-loadout-reason">Lý do lưu *</label>
        <textarea className="pds-property-input" id="self-loadout-reason" required maxLength={1000} value={reason} onChange={e=>{setNotice("");setReason(e.target.value);}} disabled={!canEdit}/>
      </div>
      <div className="pds-property-actions">
        <button type="button" onClick={resetDraft} disabled={(!dirty&&!reason&&!notice)||saving}>Hoàn tác</button>
        <button type="submit" className="pds-property-save" disabled={!dirty||!canEdit||!validSelection||!reason.trim()}>{saving?"Đang lưu…":"Lưu trang bị"}</button>
      </div>
    </form>}
    </SelfLoadoutEditorLayout>
  </section>;
}
