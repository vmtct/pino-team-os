"use client";
// PAP-1809 · Compact consent UI. Public means anonymously readable inside its app audience.
// LOCAL DEMO ONLY: no real publish/revocation or verified guardian entitlement yet.
import {useEffect,useState} from "react";
import type {MediaPost} from "./media";
import {getProfile} from "./profiles";
import {PinoIcon} from "./PinoIcon";
import css from "./launcher.module.css";

export function VisibilityDialog({post,onCancel,onConfirm}:{
 post:MediaPost;onCancel:()=>void;onConfirm:()=>void;
}){
 const isShare=post.visibility==="private";
 const isMyTime=getProfile(post.ownerId).kind==="adult";
 const [consented,setConsented]=useState(false);
 useEffect(()=>{
  const key=(event:KeyboardEvent)=>{if(event.key==="Escape")onCancel()};
  document.addEventListener("keydown",key);
  return()=>document.removeEventListener("keydown",key);
 },[onCancel]);
 return <div className={css.modalBackdrop} role="presentation"
  onMouseDown={event=>{if(event.target===event.currentTarget)onCancel()}}>
  <section className={css.visibilityDialog} role="dialog" aria-modal="true"
   aria-label={isShare?"Chia sẻ bài đăng":"Ẩn bài đăng"}
   data-public-consent={isShare?"share":"hide"}
   onKeyDown={event=>{
    if(event.key!=="Tab")return;
    const items=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)'));
    if(!items.length)return;
    if(event.shiftKey&&document.activeElement===items[0]){event.preventDefault();items[items.length-1].focus()}
    else if(!event.shiftKey&&document.activeElement===items[items.length-1]){event.preventDefault();items[0].focus()}
   }}>
   <div className={css.visibilityDialogHead}>
    <span className={css.visibilityDialogIcon} aria-hidden="true"><PinoIcon name={isShare?"globe":"hide"}/></span>
    <button type="button" onClick={onCancel} className={css.visibilityClose}
      aria-label="Đóng" autoFocus><PinoIcon name="close"/></button>
   </div>
   <h2>{isShare?"Chia sẻ công khai":"Ẩn bài đăng?"}</h2>
   <p className={css.visibilitySubtitle}>{post.title}</p>
   {isShare?<div className={css.visibilityCompactContent}>
     <div className={css.audienceOption} aria-label="Phạm vi chia sẻ công khai">
      <span className={css.audienceIcon} aria-hidden="true"><PinoIcon name="globe"/></span>
      <div><strong>Cộng đồng công khai</strong>
       <small>{isMyTime?"MyTime by PINO":"PINO Afterschool"} · Xem được không cần đăng nhập</small>
      </div>
     </div>
     <label className={css.consentCheck}>
       <input type="checkbox" checked={consented} onChange={e=>setConsented(e.target.checked)}/>
       <span>{isMyTime?"Tôi đồng ý công khai tác phẩm này.":"Tôi xác nhận có quyền chia sẻ bài này công khai."}</span>
     </label>
     <p className={css.visibilityCaution}>Bản local: chia sẻ và thu hồi chưa đồng bộ ra Internet.</p>
    </div>:<p className={css.visibilityDescription}>
     Ẩn khỏi Cộng đồng trong phiên này; bài vẫn nằm trong hành trình riêng.
     <small className={css.visibilityCaution}>Bản public mẫu chưa đồng bộ thao tác Ẩn.</small>
    </p>}
   <div className={css.visibilityButtons}>
    <button type="button" className={css.visibilityCancel} onClick={onCancel}>Hủy</button>
    <button type="button" data-confirm-visibility
     className={isShare?css.visibilityConfirm:css.visibilityRevoke}
     disabled={isShare&&!consented} onClick={onConfirm}>
      {isShare?"Chia sẻ":"Ẩn"}
    </button>
   </div>
  </section>
 </div>;
}
