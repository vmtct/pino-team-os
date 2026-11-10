"use client";
// PAP-1813 · Post-share confirmation: session-only link preview, NOT real Core publication.
import {useEffect,useRef,useState} from "react";
import type {MediaPost} from "./media";
import {PinoIcon} from "./PinoIcon";
import css from "./launcher.module.css";

export function ShareLinkDialog({post,href,onClose}:{post:MediaPost;href:string;onClose:()=>void}){
 const [url,setUrl]=useState(()=>typeof window!=="undefined"?new URL(href,window.location.origin).toString():"");
 const [result,setResult]=useState("");
 const closeButton=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  setUrl(new URL(href,window.location.origin).toString());
  closeButton.current?.focus();
  const key=(event:KeyboardEvent)=>{
   if(event.key==="Escape"){event.preventDefault();onClose();}
  };
  document.addEventListener("keydown",key);
  return()=>document.removeEventListener("keydown",key);
 },[href,onClose]);
 const copy=async()=>{
  if(!url)return;
  try{
   if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(url);}
   else{
    const input=document.querySelector<HTMLInputElement>('[data-share-result-url="'+post.id+'"]');
    if(!input)throw Error("input unavailable");
    input.select();
    if(!document.execCommand("copy"))throw Error("copy unsupported");
   }
   setResult("Đã sao chép link xem thử");
  }catch{setResult("Không thể sao chép trên trình duyệt này");}
 };
 return <div className={css.modalBackdrop} role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
  <section className={css.shareResultDialog} role="dialog" aria-modal="true"
   aria-label="Link xem trực tiếp bài đăng" data-share-result={post.id} data-media-type={post.type}
   onKeyDown={e=>{
    if(e.key!=="Tab")return;
    const items=[...e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled)')];
    if(!items.length)return;
    if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items[items.length-1].focus();}
    else if(!e.shiftKey&&document.activeElement===items[items.length-1]){e.preventDefault();items[0].focus();}
   }}>
   <div className={css.shareResultHeader}>
    <span className={css.shareResultSuccess} aria-hidden="true"><PinoIcon name="link"/></span>
    <button ref={closeButton} type="button" onClick={onClose} aria-label="Đóng link chia sẻ" className={css.visibilityClose}>
     <PinoIcon name="close"/>
    </button>
   </div>
   <h2>Link xem bài đăng</h2>
   <p className={css.shareResultTitle}>{post.title} · {post.type==="photo"?"Ảnh":"Reel"}</p>
   <label htmlFor={"piner-share-url-"+post.id}>Đường dẫn trực tiếp</label>
   <input id={"piner-share-url-"+post.id} data-share-result-url={post.id}
    type="text" readOnly value={url} onFocus={e=>e.currentTarget.select()}
    aria-label={"Đường dẫn trực tiếp bài "+post.title}/>
   <div className={css.shareResultActions}>
    <button type="button" onClick={copy} data-copy-shared-post={post.id}>
     <PinoIcon name="share"/> Sao chép link
    </button>
   </div>
   {result&&<p role="status" className={css.shareResultStatus}>{result}</p>}
   <p className={css.shareResultCaution}>Link xem thử trong phiên trình duyệt này; chưa đăng công khai ra Internet.</p>
  </section>
 </div>;
}
