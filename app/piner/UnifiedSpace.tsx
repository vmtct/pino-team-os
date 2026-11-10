"use client";
// PAP-1775 · PNR-APP-HUB · ONE responsive portfolio UI, four compact bottom tabs.
// Synthetic local prototype only: no authenticated guardian, child media, Core/API writes.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Glyph, PostCard, PreviewDialog } from "./SharedShell";
import { MediaArtwork } from "./MediaArtwork";
import { VisibilityDialog } from "./VisibilityDialog";
import { ShareLinkDialog } from "./ShareLinkDialog";
import { SessionPostFullscreen,UnavailableSessionPost } from "./SessionPostFullscreen";
import { ReelViewer } from "./ReelViewer";
import { publicCommunityHref, isPublicFixture } from "./publicApproved";
import { POSTS, type MediaPost, type Visibility } from "./media";
import { useActiveProfile, isManagedChild, getProfile } from "./profiles";
import { ChildSwitcher } from "./ChildSwitcher";
import css from "./launcher.module.css";
import {PinoIcon} from "./PinoIcon";
import {SPACES,isInSpace,pathFor,type PinerSpace} from "./spaces";

export type UnifiedTab = "home" | "grid" | "reels" | "community";
const TABS = [
 {id:"home",label:"Bảng tin",icon:"home"},
 {id:"grid",label:"Bộ sưu tập",icon:"grid"},
 {id:"reels",label:"Reels",icon:"video"},
 {id:"community",label:"Cộng đồng",icon:"community"}
] as const;

function dateSort(a:MediaPost,b:MediaPost){
 const toNumber=(date:string)=>{const [day,month]=date.split("/").map(Number);return (month||0)*32+(day||0);};
 return toNumber(b.date)-toNumber(a.date);
}
// PAP-1827 / PNR-APP-HUB · canonical brand left and switcher right.
function Header({currentChild,select,space,collapsed}:{currentChild:string;select:(id:"an"|"binh")=>void;space:PinerSpace;collapsed:boolean}){
 const profile=getProfile(currentChild==="binh"?"binh":"an");
 return <header className={css.unifiedHeader} data-piner-shared="unified-header" aria-hidden={collapsed} inert={collapsed}>
    <Link href="/piner" aria-label="Piner APP · Về trang chọn ứng dụng" className={css.unifiedCanonicalBrand} data-piner-canonical-brand="true">
      <img src="https://assets.pinohouse.art/site/core/Pino%20Sigil.png" alt="PINO" width="29" height="29" loading="eager"/>
      <img src="https://app.pinohouse.art/piner_app_logo_no_yellow_transparent.png" alt="Piner APP" width="98" height="47" loading="eager"/>
    </Link>
    {space==="house"?<ChildSwitcher currentChild={profile.id as "an"|"binh"} onSelect={select}/>:<div className={css.mytimeIdentity}><span className={css.unifiedProfileCircle}>M</span><strong>MyTime · Tôi</strong></div>}
 </header>;
}
function Footer({tab,space,collapsed}:{tab:UnifiedTab;space:PinerSpace;collapsed:boolean}){
 return <nav aria-label="Điều hướng Piner Space" data-piner-shared="bottom-nav" aria-hidden={collapsed} inert={collapsed} className={css.unifiedNav}>
   <div className={css.unifiedNavInner}>{TABS.map(item=><Link href={pathFor(space,item.id)} key={item.id}
       data-tab={item.id} aria-current={item.id===tab?"page":undefined}
       className={item.id===tab?css.unifiedNavActive:css.unifiedNavItem}>
       <Glyph name={item.icon}/><small>{item.label}</small>
     </Link>)}</div>
 </nav>;
}
function MediaGrid({posts,onOpen}:{posts:MediaPost[];onOpen:(post:MediaPost)=>void}){
 return posts.length===0?<div className={css.emptyMedia}><strong>Chưa có tác phẩm nào</strong><p>Những bức tranh và giai điệu sẽ được lưu tại đây.</p></div>:
 <div data-gallery-view="grid" className={css.unifiedGallery}>{posts.map(post=><button key={post.id}
   type="button" onClick={()=>onOpen(post)} aria-label={"Xem "+post.title} className={css.galleryTile}>
   <MediaArtwork post={post}/>{post.type==="reel"&&<span><PinoIcon name="play"/> {post.duration}</span>}
 </button>)}</div>;
}
function MediaReels({posts,onOpen}:{posts:MediaPost[];onOpen:(post:MediaPost)=>void}){
 const reels=posts.filter(post=>post.type==="reel");
 return reels.length===0?<div className={css.emptyMedia}><strong>Chưa có Reel nào</strong><p>Các khoảnh khắc vẽ tranh và biểu diễn sẽ xuất hiện tại đây.</p></div>:
 <div data-reels-view="reels" className={css.unifiedReels}>{reels.map(post=><button
   type="button" className={css.reelTile} key={post.id} onClick={()=>onOpen(post)} aria-label={"Xem "+post.title}>
   <MediaArtwork post={post}/><span className={css.playDisc}><PinoIcon name="circlePlay"/></span>
   <span className={css.reelCaption}><strong>{post.title}</strong><small>{post.duration} · {post.app==="piano"?"Piano":"Hội Họa"}</small></span>
 </button>)}</div>;
}

export function PinerUnified({tab,space="house"}:{tab:UnifiedTab;space?:PinerSpace}){
 const {profile:childProfile,activeId,select,hydrated:profileReady}=useActiveProfile();
 const profile=space==="mytime"?getProfile("mai"):childProfile;
 const canManagePost=(p:MediaPost)=>space==="mytime"?p.ownerId==="mai":isManagedChild(p.ownerId);
 const [overrides,setOverrides]=useState<Record<string,Visibility>>({});
 const [visibilityReady,setVisibilityReady]=useState(false);
 const [preview,setPreview]=useState<MediaPost|null>(null);
 const [shareIntent,setShareIntent]=useState<MediaPost|null>(null);
 const [shareSuccess,setShareSuccess]=useState<MediaPost|null>(null);
 const [sharedPreviewId,setSharedPreviewId]=useState<string|null>(null);
 const [status,setStatus]=useState("");
 const [chromeCollapsed,setChromeCollapsed]=useState(false);
 const contentRef=useRef<HTMLElement|null>(null);
 const focusReturn=useRef<HTMLElement|null>(null);
 const previewReturn=useRef<HTMLElement|null>(null);

 // PAP-1827 · Bind scroll direction only to the signed-in app content viewport.
 useEffect(()=>{
  const viewport=contentRef.current;
  if(!viewport)return;
  setChromeCollapsed(false);
  let lastY=viewport.scrollTop,travel=0,lockedUntil=0;
  const onScroll=()=>{
   const y=viewport.scrollTop;
   const delta=y-lastY;lastY=y;
   if(y<=8){travel=0;lockedUntil=0;setChromeCollapsed(false);return;}
   if(performance.now()<lockedUntil||Math.abs(delta)<.75)return;
   if(Math.sign(travel)!==Math.sign(delta))travel=0;
   travel+=delta;
   if(travel>16&&y>55){
    const focused=document.activeElement;
    const header=viewport.parentElement?.querySelector('[data-piner-shared="unified-header"]');
    const footer=viewport.parentElement?.querySelector('[data-piner-shared="bottom-nav"]');
    if(focused&&(header?.contains(focused)||footer?.contains(focused)))return;
    setChromeCollapsed(true);travel=0;lockedUntil=performance.now()+260;
   }else if(travel< -12){
    setChromeCollapsed(false);travel=0;lockedUntil=performance.now()+260;
   }
  };
  viewport.addEventListener("scroll",onScroll,{passive:true});
  return()=>viewport.removeEventListener("scroll",onScroll);
 },[space,tab]);
 useEffect(()=>{
  if(preview||shareIntent||shareSuccess||sharedPreviewId)setChromeCollapsed(false);
 },[preview,shareIntent,shareSuccess,sharedPreviewId]);
 // Read the preceding PAP-1765 mock state without changing the source of ownership.
 useEffect(()=>{
  const restore:Record<string,Visibility>={};
  for(const kind of ["hoi-hoa","piano"] as const){
   const allowed=new Set(POSTS.filter(p=>p.app===kind).map(p=>p.id));
   try{
    const raw=sessionStorage.getItem("piner-pap1765-visibility-"+kind);
    if(!raw)continue;
    const data=JSON.parse(raw) as Record<string,unknown>;
    if(data&&typeof data==="object"&&!Array.isArray(data)){
     for(const [id,value] of Object.entries(data)){
      if(allowed.has(id)&&(value==="private"||value==="community"))restore[id]=value;
     }
    }
   }catch{/* Synthetic session can be blocked; no real write occurs. */}
  }
  setOverrides(restore);
  setVisibilityReady(true);
 },[]);
 useEffect(()=>{
  setSharedPreviewId(new URLSearchParams(window.location.search).get("post"));
 },[space]);
 const loaded=profileReady&&visibilityReady;
 const all:MediaPost[]=loaded?[...POSTS].filter(p=>isInSpace(p,space)).map(p=>({...p,visibility:overrides[p.id]??p.visibility})).sort(dateSort):[];
 const sharedPreviewPost=sharedPreviewId?all.find(p=>p.id===sharedPreviewId&&p.visibility==="community"&&canManagePost(p)):undefined;
 const own=all.filter(p=>p.ownerId===(space==="mytime"?"mai":activeId));
 const visible=tab==="community"?all.filter(p=>p.visibility==="community"):tab==="home"?[...own,...all.filter(p=>p.ownerId==="pino-piano")].sort(dateSort):own;
 const restoreFocus=()=>requestAnimationFrame(()=>{
  if(focusReturn.current?.isConnected)focusReturn.current.focus();
  else document.querySelector<HTMLAnchorElement>('[data-piner-shared="bottom-nav"] a[aria-current="page"]')?.focus();
 });
 const openPreview=(post:MediaPost)=>{
   previewReturn.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
   setPreview(post);
 };
 const closePreview=()=>{
   setPreview(null);
   requestAnimationFrame(()=>{
     if(previewReturn.current?.isConnected)previewReturn.current.focus();
     else document.querySelector<HTMLAnchorElement>('[data-piner-shared="bottom-nav"] a[aria-current="page"]')?.focus();
   });
 };
 const closeSharedPreview=()=>{
  const target=new URL(window.location.href);
  target.searchParams.delete("post");
  window.history.replaceState(null,"",target.pathname+target.search+target.hash);
  setSharedPreviewId(null);
  requestAnimationFrame(()=>document.querySelector<HTMLAnchorElement>('[data-piner-shared="bottom-nav"] a[aria-current="page"]')?.focus());
 };
 const requestVisibility=(post:MediaPost)=>{
  // In real Core work this must be enforced by verified guardian ACL; this is UI fixture only.
  if(!canManagePost(post))return;
  focusReturn.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
  setPreview(null);setShareIntent(post);setStatus("");
 };
 const confirmVisibility=()=>{
  if(!shareIntent||!canManagePost(shareIntent))return;
  const next:Visibility=shareIntent.visibility==="private"?"community":"private";
  const update={...overrides,[shareIntent.id]:next};
  setOverrides(update);
  try{
   const appIds=Object.fromEntries(Object.entries(update).filter(([id])=>POSTS.some(p=>p.id===id&&p.app===shareIntent.app)));
   sessionStorage.setItem("piner-pap1765-visibility-"+shareIntent.app,JSON.stringify(appIds));
  }catch{/* In-memory mock remains usable. */}
  setShareIntent(null);setPreview(null);
  if(next==="community"){
   setShareSuccess({...shareIntent,visibility:next});
   setStatus("");
  }else{
   setStatus(isPublicFixture(shareIntent.id)?"Đã thu hồi trong phiên demo. Bản Public local vẫn là dữ liệu mẫu tĩnh.":"Đã thu hồi chia sẻ trong phiên demo.");
   restoreFocus();
  }
 };
   const title=TABS.find(item=>item.id===tab)?.label??"Bảng tin";
 return <div className={css.unifiedBackdrop}>
   <div className={css.unifiedShell} data-piner-shared="unified-shell" data-unified-tab={tab} data-piner-space={space} data-chrome-collapsed={chromeCollapsed?"true":"false"}>
           <Header currentChild={activeId} select={select} space={space} collapsed={chromeCollapsed}/>
     <main className={tab==="home"?css.unifiedContent+" "+css.unifiedHomeContent:css.unifiedContent} data-piner-slot="content" data-hydrated={loaded?"true":"false"} ref={contentRef}>
       <div className={css.unifiedContentInner}>
         {tab!=="home"&&<div className={css.unifiedPageHeading}>
                       <h1>{title}</h1>
            {tab==="community"?<a href={publicCommunityHref(space)} className={css.publicCommunityShortcut}><PinoIcon name="globe"/> <span>Công khai</span></a>:<span>{profile.display}</span>}
         </div>}
         {status&&<p className={css.visibilityStatus} role="status">{status}</p>}
         {!loaded?<div className={css.unifiedLoading} role="status">Đang mở hành trình...</div>:tab==="grid"?
           <MediaGrid posts={visible} onOpen={openPreview}/>:
           tab==="reels"?<MediaReels posts={visible} onOpen={openPreview}/>:
           <div className={css.unifiedFeed} data-feed-scope={tab==="community"?"community":"personal"}>
                           {visible.map(post=><PostCard key={post.id} post={post} scope={tab==="community"?"community":"personal"}
                canManage={canManagePost(post)} onOpen={openPreview} onRequestVisibility={requestVisibility}/>)}
           </div>}
         {loaded&&visible.length===0&&tab==="home"&&
           <div className={css.emptyMedia}><strong>Chưa có bài đăng</strong><p>Hành trình sáng tạo sẽ xuất hiện tại đây.</p></div>}
       </div>
     </main>
           <Footer tab={tab} space={space} collapsed={chromeCollapsed}/>
     {preview&&(preview.type==="reel"
       ?<ReelViewer post={all.find(p=>p.id===preview.id)??preview} onClose={closePreview}/>
       :<PreviewDialog post={all.find(p=>p.id===preview.id)??preview} onClose={closePreview}
         onRequestVisibility={requestVisibility}/>)}
     {shareIntent&&<VisibilityDialog post={shareIntent} onCancel={()=>{setShareIntent(null);restoreFocus();}}
       onConfirm={confirmVisibility}/>}
     {shareSuccess&&<ShareLinkDialog post={shareSuccess} href={"/piner/"+space+"?post="+encodeURIComponent(shareSuccess.id)}
       onClose={()=>{setShareSuccess(null);restoreFocus();}}/>}
     {loaded&&sharedPreviewId&&(sharedPreviewPost?
       <SessionPostFullscreen post={sharedPreviewPost} onClose={closeSharedPreview}/>:
       <UnavailableSessionPost onClose={closeSharedPreview}/>)}
   </div>
 </div>;
}
