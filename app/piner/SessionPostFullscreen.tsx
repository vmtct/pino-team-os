"use client";
// PAP-1813 · Full-height session preview only after caller verifies local sharing.
import {useEffect,useRef} from "react";
import type {MediaPost} from "./media";
import {syntheticReelSrc} from "./media";
import {getProfile} from "./profiles";
import {PhotoCarousel} from "./PhotoCarousel";
import {PinoIcon} from "./PinoIcon";
import css from "./launcher.module.css";

export function SessionPostFullscreen({post,onClose}:{post:MediaPost;onClose:()=>void}){
 const close=useRef<HTMLButtonElement>(null);
 const dialog=useRef<HTMLElement>(null);
 useEffect(()=>{
  close.current?.focus();
  const handle=(event:KeyboardEvent)=>{
   if(event.key==="Escape"){event.preventDefault();onClose();return;}
   if(event.key!=="Tab"||!dialog.current)return;
   const focusable=[...dialog.current.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],video[controls],[tabindex="0"]')];
   if(!focusable.length)return;
   if(event.shiftKey&&document.activeElement===focusable[0]){event.preventDefault();focusable[focusable.length-1].focus();}
   else if(!event.shiftKey&&document.activeElement===focusable[focusable.length-1]){event.preventDefault();focusable[0].focus();}
  };
  document.addEventListener("keydown",handle);
  return()=>document.removeEventListener("keydown",handle);
 },[onClose]);
 return <div className={css.fullSharedBackdrop} data-fullscreen-post={post.id} data-fullscreen-type={post.type}>
  <section ref={dialog} className={css.fullSharedViewer} role="dialog" aria-modal="true" aria-label={"Bài đăng toàn màn hình · "+post.title}>
   <header className={css.fullSharedHeader}>
    <span><PinoIcon name={post.app==="piano"?"piano":"art"}/> PINER · {post.type==="photo"?"Ảnh":"Reel"}</span>
    <button ref={close} type="button" onClick={onClose} aria-label="Đóng xem toàn màn hình"><PinoIcon name="close"/></button>
   </header>
   <div className={css.fullSharedMedia} data-fullscreen-media={post.type}>
    {post.type==="photo"?<PhotoCarousel post={post}/>:
     <video src={syntheticReelSrc(post)} autoPlay muted loop playsInline controls
      preload="metadata" aria-label={"Video bài đăng "+post.title}/>}
   </div>
   <div className={css.fullSharedInfo}>
    <strong className={css.fullSharedOwner}>{getProfile(post.ownerId).alias}</strong>
    <h1>{post.title}</h1>
    <p>{post.caption}</p>
    <div className={css.postComments} data-comment-thread={post.id}>
     {post.comments.map(item=><div className={css.postComment} key={item.id}>
       <span className={css.postCommentAvatar} aria-hidden="true">{item.author.slice(0,1)}</span>
       <p><strong>{item.author}</strong> {item.body}</p>
     </div>)}
    </div>
    <small>Minh họa trong phiên demo · Chưa phát hành link công khai.</small>
   </div>
  </section>
 </div>;
}

export function UnavailableSessionPost({onClose}:{onClose:()=>void}){
 return <div className={css.fullSharedBackdrop} data-fullscreen-denied="true">
  <section className={css.fullSharedUnavailable} role="alert">
   <strong>Không thể mở bài đăng</strong>
   <p>Bài chưa được chia sẻ trong phiên này hoặc không thuộc không gian hiện tại.</p>
   <button type="button" onClick={onClose}>Về bảng tin</button>
  </section>
 </div>;
}
