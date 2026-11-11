"use client";
// PAP-1872 / PNR-APP-HUB · community-only carousel of synthetic correctly proportioned art.
// The five illustrations are mock aspect-ratio canvases, NOT uploaded student photos.
import {useRef,useState,type TouchEvent as ReactTouchEvent,type PointerEvent as ReactPointerEvent,type KeyboardEvent as ReactKeyboardEvent} from "react";
import {MediaArtwork} from "./MediaArtwork";
import {PinoIcon} from "./PinoIcon";
import type {MediaPost} from "./media";
import css from "./launcher.module.css";

type Frame={label:string;shape:string;ratio:number;width:number;height:number};
const RATIOS:readonly Frame[]=[
 {label:"Dọc 9:16",shape:"9:16",ratio:9/16,width:1080,height:1920},
 {label:"Chân dung 4:5",shape:"4:5",ratio:4/5,width:1080,height:1350},
 {label:"Vuông 1:1",shape:"1:1",ratio:1,width:1080,height:1080},
 {label:"Ngang 3:2",shape:"3:2",ratio:3/2,width:1500,height:1000},
 {label:"Toàn cảnh 16:9",shape:"16:9",ratio:16/9,width:1920,height:1080}
];
// One Journey system event, two Journey learners and one MyTime workshop.
// Other posts deliberately remain single-image to demonstrate both rendering modes.
const MULTI_IMAGE_DEMOS=new Set(["sys-event","a4","p2","a5"]);

function AspectArtwork({post,frame,index}:{post:MediaPost;frame:Frame;index:number}){
 const w=frame.width,h=frame.height,k=Math.min(w,h);
 const piano=post.app==="piano";
 const tones=piano?
   [["#c7bad5","#62567c","#e5d4df"],["#b7d4ce","#557e79","#f6e7d2"],["#e9c5b9","#a66d84","#f9e8da"],["#a5becd","#495e81","#eee6e5"],["#dcc2a3","#8c697e","#e9d9dc"]][index]:
   [["#eab7ad","#d68d92","#fcf0dc"],["#b9d7cb","#5b9587","#f1ead1"],["#f2d8b5","#b07a9d","#ffedcf"],["#b4ccdc","#5989a4","#f2dfc9"],["#d4c2da","#93759d","#fbe6cf"]][index];
 const id=post.id+"-aspect-"+index;
 return <svg className={css.communityCarouselIllustration} viewBox={"0 0 "+w+" "+h}
   preserveAspectRatio="xMidYMid meet" role="img" aria-label={"Tranh minh họa "+frame.shape+" cho "+post.title}>
    <defs>
      <linearGradient id={id+"-bg"} x1="0" x2="1" y1="0" y2="1">
        <stop stopColor={tones[0]}/><stop offset=".55" stopColor={tones[1]}/><stop offset="1" stopColor={tones[2]}/>
      </linearGradient>
      <linearGradient id={id+"-shine"} x1="0" x2="0" y1="0" y2="1">
        <stop stopColor="#fff9" /><stop offset="1" stopColor="#fff0"/>
      </linearGradient>
    </defs>
    <rect width={w} height={h} fill={"url(#"+id+"-bg)"}/>
    <circle cx={w*.76} cy={h*.21} r={k*.29} fill="#fff9" opacity=".52"/>
    <path d={"M0 "+h*.68+" Q"+w*.24+" "+h*.53+" "+w*.48+" "+h*.65+" T"+w+" "+h*.53+" V"+h+" H0Z"} fill={tones[2]} opacity=".45"/>
    {piano?<g transform={"translate("+w*.06+" "+h*.43+") rotate(-7 "+w*.43+" "+h*.18+")"}>
      <rect x={0} y={0} width={w*.86} height={h*.27} rx={k*.025} fill="#24233b" stroke="#ddd8e6" strokeWidth={k*.012}/>
      {Array.from({length:10},(_,i)=><rect key={"white"+i} x={w*.014+i*w*.083} y={k*.014} width={w*.081} height={h*.245} rx={k*.005} fill="#f7f1ec" stroke="#a6a0ad" strokeWidth={k*.002}/>)}
      {[0,1,3,4,5,7,8].map(i=><rect key={"black"+i} x={w*.055+i*w*.083} y={k*.012} width={w*.047} height={h*.145} rx={k*.005} fill="#30283c"/>)}
    </g>:<g>
      <path d={"M"+w*.16+" "+h*.91+" Q"+w*.47+" "+h*.69+" "+w*.34+" "+h*.28} stroke="#4b8175" strokeWidth={k*.035} fill="none" strokeLinecap="round"/>
      <path d={"M"+w*.36+" "+h*.69+" Q"+w*.61+" "+h*.56+" "+w*.7+" "+h*.35} stroke="#467a72" strokeWidth={k*.028} fill="none" strokeLinecap="round"/>
      {[[.34,.28],[.69,.35],[.41,.57],[.19,.68]].map(([x,y],i)=><g key={i}>
        <circle cx={w*x} cy={h*y} r={k*(i===0?.19:.135)} fill={i%2?"#f7d1c4":"#f5eed7"} opacity=".92"/>
        <circle cx={w*x} cy={h*y} r={k*(i===0?.072:.048)} fill="#d5a47f"/>
      </g>)}
    </g>}
    <rect x={k*.04} y={k*.05} width={k*.33} height={k*.075} rx={k*.037} fill="#fff" opacity=".75"/>
    <text x={k*.085} y={k*.104} fontSize={k*.036} fontWeight="750" fontFamily="Arial,sans-serif" fill="#53475b">MINH HỌA</text>
    <rect x={0} y={0} width={w} height={h} fill={"url(#"+id+"-shine)"} opacity=".18"/>
  </svg>;
}

export function CommunityPhotoCarousel({post}:{post:MediaPost}){
 const multi=MULTI_IMAGE_DEMOS.has(post.id);
 const [index,setIndex]=useState(0);
 const startTouch=useRef<{x:number;y:number}|null>(null);
 const startMouse=useRef<{x:number;y:number}|null>(null);
 const go=(i:number)=>setIndex(Math.max(0,Math.min(RATIOS.length-1,i)));
 const gesture=(dx:number,dy:number)=>{
   if(Math.abs(dx)>44&&Math.abs(dx)>Math.abs(dy)*1.25)go(index+(dx<0?1:-1));
 };
 const start=(e:ReactTouchEvent)=>{const t=e.changedTouches[0];if(t)startTouch.current={x:t.clientX,y:t.clientY};};
 const end=(e:ReactTouchEvent)=>{
   const t=e.changedTouches[0],v=startTouch.current;startTouch.current=null;
   if(v&&t)gesture(t.clientX-v.x,t.clientY-v.y);
 };
 const mouseStart=(e:ReactPointerEvent)=>{if(e.pointerType==="mouse")startMouse.current={x:e.clientX,y:e.clientY};};
 const mouseEnd=(e:ReactPointerEvent)=>{
   if(e.pointerType!=="mouse"||!startMouse.current)return;
   const v=startMouse.current;startMouse.current=null;gesture(e.clientX-v.x,e.clientY-v.y);
 };
 const key=(e:ReactKeyboardEvent)=>{
   if(e.target!==e.currentTarget)return;
   if(e.key==="ArrowRight"){e.preventDefault();go(index+1);}
   if(e.key==="ArrowLeft"){e.preventDefault();go(index-1);}
 };
 if(!multi)return <div className={css.swipeMedia} data-community-media="photo" data-community-photo-kind="single">
   <div className={css.swipeArtwork}><MediaArtwork post={post}/></div>
 </div>;
 const current=RATIOS[index];
 return <div className={css.communityCarousel} data-community-media="photo" data-community-photo-kind="carousel"
   data-community-carousel={post.id} data-image-index={index} data-media-aspect={current.shape}
   data-image-count={RATIOS.length} role="region" aria-roledescription="carousel"
   aria-label={"Bộ "+RATIOS.length+" ảnh của "+post.title} tabIndex={0} onKeyDown={key}
   onTouchStart={start} onTouchEnd={end} onTouchCancel={()=>{startTouch.current=null;}}
   onPointerDown={mouseStart} onPointerUp={mouseEnd} onPointerCancel={()=>{startMouse.current=null;}}>
   <div className={css.communityCarouselAmbient} aria-hidden="true">
      <AspectArtwork post={post} frame={current} index={index}/>
   </div>
   <div className={css.communityCarouselCenter}>
     <span className={css.communityCarouselKicker}>BỘ ẢNH · {current.label}</span>
     <div className={css.communityCarouselFrame} style={{aspectRatio:String(current.ratio),width:"min(calc(100% - 32px), "+String(Math.round(current.ratio*(current.ratio<.9?46:53)*100)/100)+"dvh, 398px)"}}
       data-native-width={current.width} data-native-height={current.height}>
       <AspectArtwork post={post} frame={current} index={index}/>
     </div>
     <span className={css.communityCarouselDimensions}>{current.width} × {current.height} · Giữ nguyên tỉ lệ</span>
     <div className={css.communityCarouselPagination} role="group" aria-label="Chọn ảnh trong bộ">
       {RATIOS.map((frame,i)=><button type="button" key={frame.shape}
          aria-label={"Ảnh "+(i+1)+" / "+RATIOS.length+" · "+frame.shape} aria-current={i===index?"true":undefined}
          className={i===index?css.communityCarouselDotActive:css.communityCarouselDot}
          onClick={()=>go(i)}/>)}
     </div>
     <span className={css.communityCarouselSwipeHint} aria-hidden="true">← Vuốt ngang xem ảnh →</span>
   </div>
   <button type="button" className={css.communityCarouselPrev} onClick={()=>go(index-1)} disabled={index===0}
     aria-label={"Ảnh trước · "+post.title}><PinoIcon name="back"/></button>
   <button type="button" className={css.communityCarouselNext} onClick={()=>go(index+1)} disabled={index===RATIOS.length-1}
     aria-label={"Ảnh tiếp theo · "+post.title}><PinoIcon name="right"/></button>
   <span className={css.communityCarouselCount} aria-live="polite">{index+1} / {RATIOS.length}</span>
 </div>;
}
