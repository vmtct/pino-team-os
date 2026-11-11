"use client";
// PAP-1870 · PNR-APP-HUB · TikTok-style local Community prototype, synthetic content only.
import {useEffect,useRef,useState,type RefObject,type KeyboardEvent as ReactKeyboardEvent} from "react";
import {MediaArtwork} from "./MediaArtwork";
import {CommunityPhotoCarousel} from "./CommunityPhotoCarousel";
import {PublicShareAction} from "./PublicShareAction";
import {isPublicFixture,publicProfileHref} from "./publicApproved";
import {syntheticReelSrc,type MediaPost} from "./media";
import {getProfile} from "./profiles";
import {PinoIcon} from "./PinoIcon";
import css from "./launcher.module.css";

type Props={
 posts:MediaPost[];
 viewportRef:RefObject<HTMLElement|null>;
 canManage:(post:MediaPost)=>boolean;
 onOpen:(post:MediaPost)=>void;
 onRequestVisibility:(post:MediaPost)=>void;
};

function VideoStage({post,active}:{post:MediaPost;active:boolean}){
 const ref=useRef<HTMLVideoElement>(null);
 const [pausedByViewer,setPausedByViewer]=useState(false);
 useEffect(()=>{
  const video=ref.current;
  if(!video)return;
  if(active&&!pausedByViewer){void video.play().catch(()=>{/* Browser autoplay policy; poster remains. */});}
  else video.pause();
  if(!active)video.currentTime=0;
 },[active,pausedByViewer]);
 return <div className={css.swipeMedia} data-community-media="reel">
    <div className={css.swipeArtworkFallback}><MediaArtwork post={post}/></div>
    <video ref={ref} src={syntheticReelSrc(post)} muted loop autoPlay={active}
       playsInline preload={active?"metadata":"none"} aria-label={"Video minh họa: "+post.title}/>
    <button className={css.swipePlaybackToggle} type="button"
      onClick={()=>setPausedByViewer(v=>!v)} aria-label={pausedByViewer?"Tiếp tục phát video":"Tạm dừng video"}
      aria-pressed={pausedByViewer}>
      <PinoIcon name={pausedByViewer?"circlePlay":"video"}/>
      <span>{pausedByViewer?"Phát":"Tạm dừng"}</span>
    </button>
    <span className={css.swipeDuration}>{post.duration||"Video"} · Video mẫu</span>
 </div>;
}

function CommunitySlide({post,index,total,active,canManage,onOpen,onRequestVisibility}:{
 post:MediaPost;index:number;total:number;active:boolean;canManage:boolean;
 onOpen:(post:MediaPost)=>void;onRequestVisibility:(post:MediaPost)=>void;
}){
 const [liked,setLiked]=useState(false);
 const [commentsOpen,setCommentsOpen]=useState(false);
 const author=getProfile(post.ownerId).alias;
 const publicSample=isPublicFixture(post.id);
 useEffect(()=>{if(!active)setCommentsOpen(false);},[active]);
 useEffect(()=>{
  if(!commentsOpen)return;
  const esc=(event:KeyboardEvent)=>{if(event.key==="Escape")setCommentsOpen(false);};
  document.addEventListener("keydown",esc);
  return()=>document.removeEventListener("keydown",esc);
 },[commentsOpen]);
 return <article data-community-slide={post.id} data-post={post.id} data-post-owner={post.ownerId}
   data-post-scope="community" data-active-slide={active?"true":"false"}
   className={css.swipeSlide} aria-label={author+": "+post.title} aria-roledescription="Bài đăng cộng đồng">
   {post.type==="reel"?<VideoStage post={post} active={active}/>:<CommunityPhotoCarousel post={post}/>}
   <div className={css.swipeShade} aria-hidden="true"/>
   <div className={css.swipeTop}>
     <span className={css.swipeEyebrow}>PINO <span>·</span> {post.app==="piano"?"PIANO":"ART"}</span>
     <span data-community-index={index+1} className={css.swipeIndex}>{String(index+1).padStart(2,"0")} / {String(total).padStart(2,"0")}</span>
   </div>
   <div className={css.swipeActionRail} aria-label={"Tương tác với "+post.title}>
     <div className={css.swipeAuthorAvatar} aria-hidden="true"><PinoIcon name={post.ownerId==="pino-piano"?"piano":"profile"}/></div>
     <button type="button" className={liked?css.swipeActionSelected:css.swipeAction}
       aria-label={"Yêu thích "+post.title} aria-pressed={liked}
       onClick={()=>setLiked(v=>!v)}><PinoIcon name="heart"/><small>{post.reactions+(liked?1:0)}</small></button>
     <button type="button" className={css.swipeAction} aria-label={"Xem bình luận "+post.title}
       aria-expanded={commentsOpen} onClick={()=>setCommentsOpen(true)}>
       <PinoIcon name="comment"/><small>{post.comments.length}</small>
     </button>
     {publicSample?<div className={css.swipeShare}><PublicShareAction id={post.id} title={post.title}/></div>:
       <button type="button" disabled className={css.swipeAction}
         aria-label={"Chưa có liên kết công khai cho "+post.title} title="Chưa có liên kết công khai">
         <PinoIcon name="share"/><small>Chưa có link</small>
       </button>}
     {canManage&&<button type="button" className={css.swipeAction} data-hide-post={post.id}
       onClick={()=>onRequestVisibility(post)} aria-label={"Ẩn "+post.title}>
       <PinoIcon name="hide"/><small>Ẩn</small>
     </button>}
   </div>
   <div className={css.swipeCaption}>
      {publicSample?<a href={publicProfileHref(post.ownerId)} className={css.swipeAuthor}>@{author}</a>:
        <strong className={css.swipeAuthor}>@{author}</strong>}
      <button type="button" className={css.swipeTitle} onClick={()=>onOpen(post)}
        aria-label={"Xem chi tiết "+post.title}>{post.title} <PinoIcon name="right"/></button>
      <p data-post-caption={post.id}>{post.caption}</p>
      <span className={css.swipeMeta}>{post.date} · {post.type==="reel"?"Reel":"Ảnh"} · Nội dung mẫu đã chia sẻ</span>
   </div>
   {index===0&&total>1&&<span aria-hidden="true" className={css.swipeHint}>↑ Vuốt để khám phá</span>}
   {commentsOpen&&<div className={css.swipeCommentScrim} onClick={()=>setCommentsOpen(false)}>
     <section role="dialog" aria-modal="true" aria-label={"Bình luận "+post.title}
       className={css.swipeComments} onClick={e=>e.stopPropagation()}>
       <div className={css.swipeCommentsHeading}>
        <strong>Bình luận <small>{post.comments.length}</small></strong>
        <button type="button" autoFocus onClick={()=>setCommentsOpen(false)} aria-label="Đóng bình luận">✕</button>
       </div>
       {post.comments.length?post.comments.map(item=><div key={item.id} className={css.swipeCommentItem} data-comment-role={item.role}>
         <span aria-hidden="true">{item.author.charAt(0)}</span>
         <p><strong>{item.author}</strong>{item.body}</p>
       </div>):<p className={css.swipeNoComments}>Chưa có bình luận trong bản mẫu.</p>}
       <p className={css.swipeCommentNotice}>Bản mẫu chỉ đọc · Chưa gửi bình luận thật.</p>
     </section>
   </div>}
 </article>;
}

export function CommunitySwipeFeed({posts,viewportRef,canManage,onOpen,onRequestVisibility}:Props){
 const [activeIndex,setActiveIndex]=useState(0);
 const feedRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const viewport=viewportRef.current,feed=feedRef.current;
  if(!viewport||!feed)return;
  const slides=[...feed.querySelectorAll<HTMLElement>("[data-community-slide]")];
  if(slides.length===0)return;
  const observer=new IntersectionObserver(entries=>{
   const most=entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
   if(most){const i=slides.indexOf(most.target as HTMLElement);if(i>=0)setActiveIndex(i);}
  },{root:viewport,threshold:[.25,.5,.7,.9]});
  slides.forEach(node=>observer.observe(node));
  return()=>observer.disconnect();
 },[viewportRef,posts.length]);
 const pageThrough=(direction:number)=>{
  const feed=feedRef.current;
  if(!feed)return;
  const slides=[...feed.querySelectorAll<HTMLElement>("[data-community-slide]")];
  const next=Math.min(slides.length-1,Math.max(0,activeIndex+direction));
  slides[next]?.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"start"});
 };
 const keyDown=(e:ReactKeyboardEvent<HTMLDivElement>)=>{
  if(e.target!==e.currentTarget)return;
  if(e.key==="ArrowDown"||e.key==="PageDown"){e.preventDefault();pageThrough(1);}
  else if(e.key==="ArrowUp"||e.key==="PageUp"){e.preventDefault();pageThrough(-1);}
 };
 if(posts.length===0)return <div className={css.swipeEmpty} data-community-swipe="empty">
    <PinoIcon name="community"/><strong>Chưa có bài được chia sẻ</strong>
    <p>Chỉ những bài gia đình đã đồng ý chia sẻ mới xuất hiện ở đây.</p>
  </div>;
 return <div ref={feedRef} data-community-swipe="vertical" data-feed-scope="community" data-active-index={activeIndex}
   className={css.swipeFeed} tabIndex={0} onKeyDown={keyDown}
   role="region" aria-label="Cộng đồng · Vuốt lên hoặc xuống để xem từng bài">
   {posts.map((post,i)=><CommunitySlide key={post.id} post={post} index={i} total={posts.length}
      active={activeIndex===i} canManage={canManage(post)} onOpen={onOpen} onRequestVisibility={onRequestVisibility}/>)}
 </div>;
}
