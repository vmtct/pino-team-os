"use client";
/** PAP-2032 / PNR-WISH — readonly native View, Full Detail and append-only invalidation. */
import {useEffect,useRef,useState,type ReactNode} from "react";
import {BoQuickView} from "@/app/bo/components/registration/BoQuickView";
import {BoDataTable} from "@/app/bo/components/registration/BoDataTable";
import {BoValue} from "@/app/bo/components/registration/BoValue";
import {DetailFrame} from "@/app/components/workspace-renderer/DetailFrame";
import {DrawerFrame} from "@/app/components/workspace-renderer/DrawerFrame";
import {defaultTable} from "@/lib/bo-registration";
import {confirmWishInvalidation,prepareWishInvalidation,type BoWishDetail,type BoWishEvent} from "@/lib/pls-wish-bo-contract";
import {wishEventModule,wishEventRow,wishOutcomeModule,wishOutcomeRows} from "./wish-event-view";
export type WishInvalidationAttempt=ReturnType<typeof prepareWishInvalidation>;
import type {WishInvalidationJournal} from "@/lib/pls-wish-invalidation-journal";
export type WishInvalidationHost={execute:(attempt:WishInvalidationAttempt)=>Promise<{receipt:unknown;readback:unknown}>;journal:WishInvalidationJournal};
export function BoWishEventView({event,onClose,onDetail}:{event:BoWishEvent;onClose:()=>void;onDetail:()=>void}){
 return <BoQuickView moduleKey="wish-events" module={wishEventModule} record={wishEventRow(event)} onClose={onClose} onDetail={onDetail}/>;
}
export function BoWishEventDetail({event,onBack,onVerified,onReload,invalidate,mobileMenu}:{event:BoWishDetail;onBack:()=>void;onVerified:(next:BoWishDetail)=>void;onReload:()=>void;invalidate?:WishInvalidationHost;mobileMenu?:ReactNode}){
 const [tab,setTab]=useState("overview"),[table,setTable]=useState(()=>defaultTable(wishOutcomeModule.fields)),[page,setPage]=useState(1);
 const [confirm,setConfirm]=useState(false),[reason,setReason]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[uncertain,setUncertain]=useState<WishInvalidationAttempt|null>(null);
 const flight=useRef(false),row=wishEventRow(event);
 const [checking,setChecking]=useState(!!invalidate),[journalError,setJournalError]=useState(""),[epoch,setEpoch]=useState(0);
 useEffect(()=>{if(!invalidate)return;let canceled=false;void invalidate.journal.read(event).then(a=>{if(!canceled){setUncertain(a);setJournalError("");if(a){setReason(a.body.reason);setConfirm(true);}}}).catch(e=>{if(!canceled)setJournalError(e instanceof Error?e.message:"Không thể tải Invalidate đang chờ.");}).finally(()=>{if(!canceled)setChecking(false);});return()=>{canceled=true;};},[event,invalidate,epoch]);
 async function execute(){
  if(!invalidate||flight.current||checking||journalError||(!uncertain&&event.status!=="COMMITTED"))return;
  flight.current=true;setBusy(true);setError("");
  try{const pending=await invalidate.journal.read(event);if(pending&&(!uncertain||JSON.stringify(pending)!==JSON.stringify(uncertain)))throw Error("Có Invalidate đang chờ. Đối soát đúng yêu cầu này.");if(uncertain&&!pending)throw Error("Yêu cầu đang chờ đã thay đổi.");const attempt=pending??prepareWishInvalidation(event,reason);await invalidate.journal.reserve(event,attempt);setUncertain(attempt);const r=await invalidate.execute(attempt);const next=confirmWishInvalidation(attempt,r.receipt,r.readback,event);await invalidate.journal.complete(event,attempt);setUncertain(null);setConfirm(false);onVerified(next);}
  catch(e){setError((e instanceof Error?e.message:"Chưa đối soát được kết quả.")+" Không tạo yêu cầu mới.");try{const a=await invalidate.journal.read(event);setUncertain(a);if(a)setReason(a.body.reason);else setJournalError("Tải lại trạng thái Event trước khi tiếp tục.");}catch{setJournalError("Không thể đối soát journal.");}}
  finally{flight.current=false;setBusy(false);}
 }
 return <DetailFrame title={row.name} subtitle="Wish Event" mobileMenu={mobileMenu} tabs={[{id:"overview",label:"Tổng quan"},{id:"items",label:"Item"},{id:"history",label:"Lịch sử"}]} selected={tab} onSelect={setTab} onBack={()=>{if(!flight.current&&!uncertain&&!confirm)onBack();}} actions={invalidate&&event.status==="COMMITTED"?<button type="button" className="secondary-btn" disabled={confirm||busy||checking||!!journalError||!!uncertain} onClick={()=>{setError("");setReason("");setConfirm(true);}}>Invalidate</button>:undefined}>
 {tab==="overview"?<div className="v24-prop-grid">
 {wishEventModule.fields.map(f=><div className="v24-prop-item" key={f.key}><span>{f.label}</span><BoValue field={f} value={row[f.key]}/></div>)}
 {([["Event ID",event.eventId],["Self ID",event.selfId],["Visit ID",event.visitId],["Policy revision",event.policyRevisionId],["Banner revision",event.bannerRevisionId],["Family",event.familyId],["PLS / Wish",event.unitCost],["Số dư trước",event.balanceBefore],["Số dư sau",event.balanceAfter]] as const).map(([label,value])=><div className="v24-prop-item" key={label}><span>{label}</span><span>{value}</span></div>)}
 </div>:tab==="items"?<BoDataTable module={wishOutcomeModule} rows={wishOutcomeRows(event)} loadState="ready" value={table} update={p=>setTable(s=>({...s,...p}))} page={page} setPage={setPage} onOpen={()=>{}} onSettings={()=>{}} filterOpen={false} setFilterOpen={()=>{}} views={[]} changeViews={()=>{}} activeView={null} applyView={()=>{}} reset={()=>setTable(defaultTable(wishOutcomeModule.fields))} undo={()=>{}} canUndo={false} showChrome={false} openEnabled={false}/>:<div className="v24-prop-grid"><div className="v24-prop-item"><span>COMMITTED</span><span>{event.createdAt} · {event.actorName??"—"}</span></div>{event.status==="INVALIDATED"&&<><div className="v24-prop-item"><span>INVALIDATED</span><span>{event.reversedAt} · {event.reversedByName??"—"}</span></div><div className="v24-prop-item"><span>Lý do</span><span>{event.reversalReason}</span></div><div className="v24-prop-item"><span>Hoàn PLS</span><span>{event.spent}</span></div></>}</div>}
 {journalError&&<div role="alert">{journalError} <button type="button" className="secondary-btn" disabled={busy||checking} onClick={()=>{setChecking(true);setEpoch(x=>x+1);}}>Kiểm tra journal</button></div>}
 {confirm&&<DrawerFrame title="Invalidate Wish Event" path="Wish Events" onClose={()=>{if(!flight.current&&!uncertain)setConfirm(false);}} footer={<><button type="button" className="secondary-btn" disabled={busy||!!uncertain} onClick={()=>setConfirm(false)}>Hủy</button>{uncertain?<button type="button" className="primary-btn" disabled={busy||checking||!!journalError} onClick={()=>void execute()}>Đối soát yêu cầu</button>:<button type="button" className="primary-btn" disabled={busy||checking||!!journalError||!reason.trim()} onClick={()=>void execute()}>Xác nhận Invalidate</button>}</>}>
 <p>Hoàn {event.spent} PLS, thu hồi {event.outcomes.filter(o=>!o.duplicate).length} Item grant từ giao dịch này nếu Core xác nhận đủ điều kiện. Giữ nguyên sự kiện gốc.</p>
 <label className="v24-prop-item">Lý do<textarea className="edit-input" maxLength={1000} disabled={busy||!!uncertain} value={reason} onChange={e=>setReason(e.target.value)}/></label>
 {error&&<p role="alert">{error}</p>}{uncertain&&<button type="button" className="secondary-btn" disabled={busy||checking} onClick={onReload}>Tải lại để đối soát</button>}
 </DrawerFrame>}
 </DetailFrame>;
}
