"use client";
// PAP-1800 · Public read-only carousel/reel, never imports private POSTS or guardian session.
import {useRef,useState} from "react";
import type {PublicPost} from "./publicTypes";
import {MediaArtwork} from "./MediaArtwork";
import css from "./launcher.module.css";

export function PublicMedia({post}:{post:PublicPost}){
 const [index,setIndex]=useState(0);
 const start=useRef<number|null>(null);
 const next=(delta:number)=>setIndex(i=>Math.min(post.frames.length-1,Math.max(0,i+delta)));
 if(post.type==="reel")return <div className={css.publicVideoBox}>
  <video controls playsInline preload="metadata" muted src={post.videoSrc??undefined}
    aria-label={"Video minh họa "+post.title}/>
  <small>Video đồ họa minh họa · không phải video học viên.</small>
 </div>;
 return <section className={css.publicCarousel} data-public-carousel={post.id} data-slide={index}
   role="region" aria-label={"Bộ ảnh "+post.title} tabIndex={0}
   onTouchStart={e=>{start.current=e.changedTouches[0]?.clientX??null}}
   onTouchEnd={e=>{if(start.current===null)return;const dx=(e.changedTouches[0]?.clientX??start.current)-start.current;start.current=null;if(Math.abs(dx)>36)next(dx<0?1:-1)}}
   onKeyDown={e=>{if(e.key==="ArrowRight")next(1);if(e.key==="ArrowLeft")next(-1)}}>
   <div className={css.publicCarouselSlides} style={{transform:"translateX(-"+index*100+"%)"}}>
    {post.frames.map((visual,i)=><div key={i} className={css.publicSlide} aria-hidden={index!==i}>
      <MediaArtwork post={{id:post.id+"-"+i,app:post.app,visual,title:post.title}}/>
    </div>)}
   </div>
   {post.frames.length>1&&<><span className={css.publicCount}>{index+1}/{post.frames.length}</span>
     <button type="button" className={css.publicPrev} onClick={()=>next(-1)}
       disabled={index===0} aria-label="Ảnh trước">‹</button>
     <button type="button" className={css.publicNext} onClick={()=>next(1)}
       disabled={index===post.frames.length-1} aria-label="Ảnh tiếp">›</button>
     <div className={css.publicDots}>{post.frames.map((_,i)=><button type="button" key={i}
      aria-label={"Đến ảnh "+(i+1)} aria-current={i===index?"true":undefined}
      onClick={()=>setIndex(i)} className={i===index?css.publicDotSelected:css.publicDot}/>)}</div>
   </>}
 </section>;
}
