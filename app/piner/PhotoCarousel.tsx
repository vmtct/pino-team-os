"use client";
// PAP-1797 · Feed photo taps are inert; only swipe/arrows/dots change in-place slides.
import { useRef,useState } from "react";
import { MediaArtwork } from "./MediaArtwork";
import { PHOTO_CAROUSELS,type MediaPost } from "./media";
import css from "./launcher.module.css";
import {PinoIcon} from "./PinoIcon";

export function PhotoCarousel({post}:{post:MediaPost}){
 const frames=PHOTO_CAROUSELS[post.id]??[post.visual];
 const [index,setIndex]=useState(0);
 const touchX=useRef<number|null>(null);
 const move=(amount:number)=>setIndex(current=>Math.max(0,Math.min(frames.length-1,current+amount)));
 return <div className={css.photoCarousel} data-photo-carousel={post.id} data-slide-index={index}
   role="region" aria-roledescription="carousel" aria-label={"Ảnh trong bài "+post.title}
   tabIndex={0}
   onKeyDown={event=>{
     if(event.target!==event.currentTarget)return;
     if(event.key==="ArrowRight"){event.preventDefault();move(1)}
     else if(event.key==="ArrowLeft"){event.preventDefault();move(-1)}
   }}
   onTouchStart={event=>{touchX.current=event.changedTouches[0]?.clientX??null}}
   onTouchEnd={event=>{
     if(touchX.current===null)return;
     const delta=(event.changedTouches[0]?.clientX??touchX.current)-touchX.current;
     touchX.current=null;
     if(Math.abs(delta)>36)move(delta<0?1:-1);
   }}
   onTouchCancel={()=>{touchX.current=null}}>
   <div className={css.photoStrip} style={{transform:"translate3d(-"+index*100+"%,0,0)"}}>
     {frames.map((visual,position)=><div className={css.photoSlide} key={position}
       aria-hidden={position!==index}>
       <MediaArtwork post={{...post,visual,id:post.id+"-slide-"+position}}/>
     </div>)}
   </div>
   {frames.length>1&&<>
     <span className={css.photoCounter} aria-live="polite">{index+1} / {frames.length}</span>
     <button type="button" className={css.photoPrevious}
       aria-label={"Ảnh trước · "+post.title} disabled={index===0} onClick={()=>move(-1)}><PinoIcon name="right" className={css.pinoFaPrev}/></button>
     <button type="button" className={css.photoNext}
       aria-label={"Ảnh tiếp theo · "+post.title} disabled={index===frames.length-1} onClick={()=>move(1)}><PinoIcon name="right"/></button>
     <div className={css.photoDots} role="group" aria-label="Chọn ảnh">
       {frames.map((_,position)=><button type="button" key={position}
         className={position===index?css.photoDotActive:css.photoDot}
         aria-label={"Ảnh "+(position+1)+" / "+frames.length}
         aria-current={position===index?"true":undefined}
         onClick={()=>setIndex(position)}/>)}
     </div>
   </>}
 </div>;
}
