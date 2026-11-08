"use client";
import {useEffect,useRef} from "react";
import type {SpecialtyV2Detail} from "@/lib/ho-specialty-v2-reader";
import styles from "./HoSpecialtyPublishDialog.module.css";
/** PAP-1695 / SPEC-UNLOCK: confirmation after saving DSA inline Trạng thái. */
export function HoSpecialtyPublishDialog({detail,warnings,busy,error,onCancel,onConfirm,focusReturn}:{
 detail:SpecialtyV2Detail;warnings:readonly string[];busy:boolean;error:string;
 onCancel:()=>void;onConfirm:()=>void;focusReturn:HTMLElement|null;
}){
 const panel=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
  const key=(e:KeyboardEvent)=>{
   if(e.key==="Escape"){e.preventDefault();if(!busy)onCancel();return;}
   if(e.key!=="Tab"||!panel.current)return;
   const list=[...panel.current.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
   const i=list.indexOf(document.activeElement as HTMLButtonElement);
   if(e.shiftKey&&i<=0){e.preventDefault();list.at(-1)?.focus();}
   else if(!e.shiftKey&&i===list.length-1){e.preventDefault();list[0]?.focus();}
  };
  document.addEventListener("keydown",key);
  return()=>document.removeEventListener("keydown",key);
 },[busy,onCancel]);
 useEffect(()=>()=>{if(focusReturn?.isConnected)focusReturn.focus();},[focusReturn]);
 return <div className={styles.overlay} onMouseDown={e=>{if(e.currentTarget===e.target&&!busy)onCancel();}}>
  <div ref={panel} className={styles.dialog} role="dialog" aria-modal="true"
   aria-labelledby="specialty-publish-title" aria-describedby="specialty-publish-description">
   <div className={styles.header}><div><span className={styles.kicker}>Chuyên đề · Trạng thái</span>
    <h2 id="specialty-publish-title">Xuất bản chuyên đề</h2></div>
    <button type="button" className={styles.icon} aria-label="Đóng" disabled={busy} onClick={onCancel}>×</button></div>
   <div className={styles.content}>
    <strong>{detail.name}</strong>
    <p id="specialty-publish-description">Sau khi xuất bản, chuyên đề có thể được cấp cho học viên. Cấu hình DRAFT sẽ khóa và chưa thể hoàn tác.</p>
    {warnings.length?<><h3>Cần hoàn tất trước khi xuất bản</h3><ul className={styles.warnings}>{warnings.map(w=><li key={w}>{w}</li>)}</ul></>:
     <p role="status">Đã kiểm tra cấu hình cơ bản. Core sẽ kiểm chứng trạng thái Mission, Path và tiên quyết khi lưu.</p>}
    {error?<p role="alert" className={styles.error}>{error}</p>:null}
   </div>
   <div className={styles.footer}>
    <button type="button" className="secondary-btn" disabled={busy} onClick={onCancel}>Hủy</button>
    <button type="button" className="primary-btn" disabled={busy||warnings.length>0} onClick={onConfirm}>
     {busy?"Đang xác minh…":"Xác nhận xuất bản"}
    </button></div>
  </div>
 </div>;
}
