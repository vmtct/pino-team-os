"use client";
// PAP-1803 · Guest variant of the existing PINO Community feed. Public props are sanitized
// SERVER-SIDE; never import POSTS/media fixtures here. All writable actions gate to Login.
import Link from "next/link";
import {useCallback,useEffect,useRef,useState} from "react";
import type {PublicPost} from "./publicTypes";
import {PublicMedia} from "./PublicMedia";
import {MediaArtwork} from "./MediaArtwork";
import {PublicShareAction} from "./PublicShareAction";
import {publicProfileHref,publicCommunityHref} from "./publicApproved";
import type {PinerSpace} from "./spaces";
import css from "./launcher.module.css";
import {PinoIcon} from "./PinoIcon";

type Props={posts:PublicPost[];mode:"community"|"profile";selectedPostId?:string;space:PinerSpace};
function guestLogin(space:PinerSpace){return (space==="house"?"/piner/public/login/afterschool":"/piner/public/login")+"?returnTo="+encodeURIComponent(window.location.pathname+window.location.search)}
function GuestComments({post,expanded}:{post:PublicPost;expanded:boolean}){
 const replies=expanded?post.comments:post.comments.slice(0,1);
 return <div className={css.postComments} data-comment-thread={post.id} data-expanded={expanded?"true":"false"}>
  {replies.map(c=><div className={css.postComment} key={c.id} data-comment-author={c.author}>
   <span className={css.postCommentAvatar} aria-hidden="true">{c.author.slice(0,1)}</span>
   <p><strong>{c.author}</strong> {c.body}</p>
  </div>)}
  {!expanded&&post.comments.length>1&&<small className={css.moreCommentsHint}>Còn {post.comments.length-1} bình luận</small>}
 </div>;
}
function GuestFeedCard({post,onPlay,onLogin}:{post:PublicPost;onPlay:(post:PublicPost)=>void;onLogin:()=>void}){
 const [expanded,setExpanded]=useState(false);
 return <article className={css.postCard} data-post={post.id} data-post-owner={post.ownerId} data-post-scope="public" id={"public-post-"+post.id}>
  <div className={css.postHead}>
   <Link className={css.postAvatar+" "+css.guestAvatarLink} href={publicProfileHref(post.ownerId)}
    aria-label={"Xem hồ sơ "+post.alias}><PinoIcon name={post.app==="piano"?"piano":"art"}/></Link>
   <div className={css.postMeta}>
    <Link className={css.guestAuthorLink} href={publicProfileHref(post.ownerId)}>{post.alias}</Link>
    <small>{post.date} · {post.app==="piano"?"Piano":"Hội Họa"}</small>
   </div>
   <span className={css.sharedBadge}>Công khai</span>
  </div>
  {post.type==="photo"?<PublicMedia post={post}/>:
   <button type="button" className={css.posterButton} onClick={()=>onPlay(post)} aria-label={"Phát video "+post.title}>
    <MediaArtwork post={post}/><span className={css.reelOverlay}>
      <span><PinoIcon name="circlePlay"/></span><small>{post.duration}</small></span>
   </button>}
  <div className={css.postActions} data-action-row={post.id}>
    <button type="button" aria-label={"Đăng nhập để yêu thích "+post.title} onClick={onLogin}>
      <PinoIcon name="heart"/> <span>{post.reactions}</span>
    </button>
    <button type="button" aria-expanded={expanded} aria-label={"Xem bình luận "+post.title} onClick={()=>setExpanded(v=>!v)}>
      <PinoIcon name="comment"/> <span>{post.comments.length}</span>
    </button>
    <PublicShareAction id={post.id} title={post.title}/>
  </div>
  <div className={css.postBody}>
   <strong>{post.title}</strong><p data-post-caption={post.id}>{post.caption}</p>
   <GuestComments post={post} expanded={expanded}/>
   {expanded&&<button type="button" className={css.guestWriteComment} onClick={onLogin}
     aria-label={"Đăng nhập để bình luận "+post.title}>Viết bình luận… <span>Đăng nhập</span></button>}
  </div>
 </article>;
}
function GuestReel({post,onClose}:{post:PublicPost;onClose:()=>void}){
 const closeRef=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  closeRef.current?.focus();
  const esc=(e:KeyboardEvent)=>{if(e.key==="Escape"){e.preventDefault();onClose()}};
  document.addEventListener("keydown",esc);
  return()=>document.removeEventListener("keydown",esc);
 },[onClose]);
 return <div className={css.reelViewerBackdrop} data-reel-viewer={post.id}>
  <section role="dialog" aria-modal="true" aria-label={"Video toàn màn hình · "+post.title} className={css.reelViewer}>
   <div className={css.reelViewerTop}><span><PinoIcon name="video"/> Reels</span>
    <button ref={closeRef} type="button" onClick={onClose} aria-label="Đóng video"><PinoIcon name="close"/></button>
   </div>
   <div className={css.reelViewerStage}><video
     controls playsInline muted autoPlay loop src={post.videoSrc??undefined}
     aria-label={"Video minh họa "+post.title}/></div>
   <div className={css.reelViewerCaption}><strong>{post.alias}</strong>
     <h2>{post.title}</h2><p>{post.caption}</p>
     <small>Clip đồ họa tổng hợp, không phải video học viên.</small>
   </div>
  </section>
 </div>;
}
export function PublicFeedClient({posts,mode,selectedPostId,space}:Props){
 const [reel,setReel]=useState<PublicPost|null>(null);
 const [ready,setReady]=useState(false);
 const main=useRef<HTMLElement|null>(null);
 const lastFocus=useRef<HTMLElement|null>(null);
 useEffect(()=>{
  const el=document.querySelector<HTMLElement>('[data-public-scroll-main]');
  main.current=el;
  if(selectedPostId){
   let attempts=0;
   const position=()=>{
    const target=document.getElementById("public-post-"+selectedPostId);
    const viewport=main.current;
    if(target&&viewport){
      const vr=viewport.getBoundingClientRect(),tr=target.getBoundingClientRect();
      viewport.scrollTop+=tr.top-vr.top-8;
    }else if(attempts++<3){requestAnimationFrame(position)}
   };
   requestAnimationFrame(()=>requestAnimationFrame(position));
  }else if(el){el.scrollTop=0}
  setReady(true);
 },[selectedPostId,mode]);
 const login=()=>{window.location.assign(guestLogin(space))};
 const openReel=(post:PublicPost)=>{
   lastFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
   setReel(post);
 };
 const closeReel=useCallback(()=>{
   setReel(null);
   requestAnimationFrame(()=>lastFocus.current?.isConnected&&lastFocus.current.focus());
 },[]);
 const alias=posts[0]?.alias??"Piner";
 const owner=posts[0]?.ownerId??"an";
 return <>
  <div className={css.unifiedContentInner} data-public-mode={mode} data-public-space={space} data-hydrated={ready?"true":"false"}>
   {mode==="community"?
    <div className={css.unifiedPageHeading}>
     <h1>{space==="house"?"Cộng đồng PINO Afterschool":"Cộng đồng MyTime by PINO"}</h1><span>{posts.length} bài chia sẻ</span>
    </div>:
    <div className={css.guestProfileIntro} data-public-profile={owner}>
      <Link href={publicCommunityHref(space)} className={css.guestBack}>‹ Về Cộng đồng</Link>
      <div className={css.guestProfileTop}>
       <span className={css.guestProfileAvatar} aria-hidden="true">{alias.slice(-2, -1)}</span>
       <div><h1>{alias}</h1><p>{posts.length} bài được chia sẻ công khai</p></div>
       <button type="button" onClick={login} className={css.guestFollow}>Theo dõi</button>
      </div>
      <p className={css.guestProfileHint}>{space==="mytime"?"Hết những bận rộn, đến giờ mình tận hưởng.":"Hết giờ học, đến giờ con khám phá."} · Ảnh và Reel</p>
    </div>}
   <div className={css.unifiedFeed} data-feed-scope={mode==="community"?"public-community":"public-profile"}>
    {posts.map(post=><GuestFeedCard key={post.id} post={post} onPlay={openReel} onLogin={login}/>)}
   </div>
   <p className={css.publicDisclaimer}>Bản prototype sử dụng nội dung tổng hợp. Tương tác sẽ yêu cầu đăng nhập PINO.</p>
  </div>
  {reel&&<GuestReel post={reel} onClose={closeReel}/>}
 </>;
}
