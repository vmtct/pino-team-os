"use client";
// PAP-1886 · PNR-IDENTITY — read-only native account History, reuse approved BO audit visuals.
import { useEffect, useRef, useState } from "react";
import { afterschoolHistoryPath, validateAfterschoolHistoryPage, type AfterschoolHistoryPage } from "@/lib/bo-afterschool-history";
import styles from "@/app/bo/components/BoSubjectHistory.module.css";

type State = {phase:"loading"} | {phase:"error";message:string} | ({phase:"ready"} & AfterschoolHistoryPage);
async function readPage(parentId:string, centerId:string, signal:AbortSignal, previous?:AfterschoolHistoryPage) {
  const response=await fetch(afterschoolHistoryPath(parentId,centerId,previous?.nextCursor),{
    method:"GET",credentials:"same-origin",mode:"same-origin",cache:"no-store",redirect:"error",headers:{Accept:"application/json"},signal,
  });
  if (!response.ok) throw new Error(response.status===403 ? "Bạn không có quyền xem lịch sử." :
    response.status===401 ? "Phiên đăng nhập đã hết hạn." : response.status===404 ? "Không tìm thấy lịch sử tài khoản." :
    "Không thể tải lịch sử. Hãy thử lại.");
  const body:unknown=await response.json();
  if(!body || typeof body!=="object" || !Object.hasOwn(body,"data")) throw Error("Không xác minh được lịch sử tài khoản.");
  const page=validateAfterschoolHistoryPage((body as {data:unknown}).data,parentId,previous?.events,previous?.nextCursor);
  return {events:[...(previous?.events??[]),...page.events],nextCursor:page.nextCursor};
}
export function AfterschoolHistory({parentId,centerId,revision}:{parentId:string;centerId:string;revision:number}) {
  // Keyed boundary: old events never remain visible for a changed account, Center or refresh.
  return <HistoryScope key={JSON.stringify([parentId,centerId,revision])} parentId={parentId} centerId={centerId}/>;
}
function HistoryScope({parentId,centerId}:{parentId:string;centerId:string}) {
  const [state,setState]=useState<State>({phase:"loading"});
  const [refresh,setRefresh]=useState(0);
  const [more,setMore]=useState(false);
  const active=useRef<AbortController|null>(null);
  useEffect(()=>{
    const controller=new AbortController();
    active.current=controller;
    void readPage(parentId,centerId,controller.signal).then(page=>{
      if(!controller.signal.aborted) setState({phase:"ready",...page});
    }).catch(()=>{
      if(!controller.signal.aborted) setState({phase:"error",message:"Không thể tải lịch sử. Kiểm tra quyền truy cập hoặc thử lại."});
    });
    return ()=>{controller.abort();active.current?.abort();active.current=null;};
  },[parentId,centerId,refresh]);
  async function next(){
    if(state.phase!=="ready" || !state.nextCursor || active.current?.signal.aborted || more) return;
    const controller=new AbortController();
    active.current=controller;
    setMore(true);
    try {
      const page=await readPage(parentId,centerId,controller.signal,state);
      if(!controller.signal.aborted) setState({phase:"ready",...page});
    } catch {
      if(!controller.signal.aborted) setState({phase:"error",message:"Không thể tải lịch sử. Kiểm tra quyền truy cập hoặc thử lại."});
    } finally {
      if(!controller.signal.aborted) setMore(false);
    }
  }
  return <section className={styles.root} aria-label="Lịch sử tài khoản" data-pap1886-history="true">
    <p>Chỉ hiển thị sự kiện cấp PIN và cấp lại PIN đã xác minh tại cơ sở đang chọn.</p>
    {state.phase==="loading" && <p role="status">Đang tải lịch sử…</p>}
    {state.phase==="error" && <><p role="alert">{state.message}</p><button type="button" className="ghost-btn" onClick={()=>{
      setState({phase:"loading"});setMore(false);setRefresh(n=>n+1);
    }}>Thử lại</button></>}
    {state.phase==="ready" && state.events.length===0 && <p role="status">Chưa có sự kiện lịch sử được xác minh.</p>}
    {state.phase==="ready" && state.events.length>0 && <div className={styles.rows} role="list">
      {state.events.map(event=><article className={styles.row} role="listitem" key={event.id}>
        <time dateTime={event.occurred_at}>{new Date(event.occurred_at).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})}</time>
        <span>{event.actor_label}</span><span>{event.action}</span>
        <span className={styles.redaction} aria-label="Dữ liệu được bảo vệ">— → —</span>
        <span className={styles.outcome} data-outcome="succeeded">Thành công</span>
      </article>)}
    </div>}
    {state.phase==="ready" && state.nextCursor && <button type="button" className="ghost-btn" disabled={more} onClick={()=>void next()}>{more?"Đang tải…":"Xem thêm"}</button>}
  </section>;
}
