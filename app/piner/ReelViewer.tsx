"use client";
// PAP-1797 · True playable synthetic MP4 in full-height Piner reel viewer; no real student media.
import { useEffect,useRef,useState } from "react";
import { getProfile } from "./profiles";
import { syntheticReelSrc,type MediaPost } from "./media";
import css from "./launcher.module.css";

export function ReelViewer({post,onClose}:{post:MediaPost;onClose:()=>void}){
 const dialog=useRef<HTMLElement>(null);
 const video=useRef<HTMLVideoElement>(null);
 const close=useRef<HTMLButtonElement>(null);
 const [hasError,setHasError]=useState(false);
 const [playing,setPlaying]=useState(false);
 useEffect(()=>{
   close.current?.focus();
   const player=video.current;
   player?.play().catch(()=>{/* Native controls can start playback when autoplay is blocked. */});
   const onKey=(event:KeyboardEvent)=>{
     if(event.key==="Escape"){event.preventDefault();onClose();return;}
     if(event.key!=="Tab"||!dialog.current)return;
     const focusable=Array.from(dialog.current.querySelectorAll<HTMLElement>(
       'button:not(:disabled),video[controls]'));
     if(!focusable.length)return;
     const first=focusable[0],last=focusable[focusable.length-1];
     if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
     else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
   };
   document.addEventListener("keydown",onKey);
   return()=>{document.removeEventListener("keydown",onKey);player?.pause();}
 },[onClose]);
 return <div className={css.reelViewerBackdrop} data-reel-viewer={post.id}>
  <section ref={dialog} className={css.reelViewer} role="dialog" aria-modal="true"
    aria-label={"Video toàn màn hình · "+post.title}>
   <div className={css.reelViewerTop}>
     <span>PINER REELS</span>
     <button ref={close} type="button" onClick={onClose} aria-label="Đóng video">✕</button>
   </div>
   <div className={css.reelViewerStage}>
     {!hasError?<video ref={video} src={syntheticReelSrc(post)}
       aria-label={"Video minh họa "+post.title}
       autoPlay muted loop playsInline controls preload="auto"
       onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)}
       onError={()=>setHasError(true)}/>:
       <div role="status" className={css.reelViewerError}>Không thể tải video minh họa.</div>}
   </div>
   <div className={css.reelViewerCaption}>
     <strong>{getProfile(post.ownerId).alias}</strong>
     <h2>{post.title}</h2>
     <p>{post.caption}</p>
     <small>{post.app==="piano"?"Piano":"Hội Họa"} · Clip đồ họa tổng hợp, không phải video học viên</small>
     <span className={css.reelViewerPlayback} role="status">{playing?"Đang phát":"Tạm dừng"}</span>
   </div>
  </section>
 </div>;
}
