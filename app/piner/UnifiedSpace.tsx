"use client";
// PAP-1775 · PNR-APP-HUB · ONE responsive portfolio UI, four compact bottom tabs.
// Synthetic local prototype only: no authenticated guardian, child media, Core/API writes.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Glyph, PostCard, PreviewDialog } from "./SharedShell";
import { MediaArtwork } from "./MediaArtwork";
import { VisibilityDialog } from "./VisibilityDialog";
import { ReelViewer } from "./ReelViewer";
import { publicCommunityHref, isPublicFixture } from "./publicApproved";
import { POSTS, type MediaPost, type Visibility } from "./media";
import { MANAGED_CHILDREN, useActiveProfile, isManagedChild, getProfile } from "./profiles";
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
function Header({currentChild,select,space}:{currentChild:string;select:(id:"an"|"binh")=>void;space:PinerSpace}){
 const profile=getProfile(currentChild==="binh"?"binh":"an");
 return <header className={css.unifiedHeader} data-piner-shared="unified-header">
       {space==="house"?<div className={css.unifiedSwitcher}>
      <span className={css.unifiedProfileCircle} aria-hidden="true">{profile.avatar}</span>
     <select id="piner-child-profile" aria-label="Chọn con đang xem" className={css.unifiedProfileSelect}
       value={profile.id} onChange={event=>select(event.target.value as "an"|"binh")}>
       {MANAGED_CHILDREN.map(child=><option value={child.id} key={child.id}>{child.display}</option>)}
     </select>

       </div>:<div className={css.mytimeIdentity}><span className={css.unifiedProfileCircle}>M</span><strong>MyTime · Tôi</strong></div>}
    <Link href="/piner" aria-label="Logo PINO · Danh sách ứng dụng" className={css.unifiedLogo}>
     <strong>PINO</strong><small>SPACE</small>
   </Link>
 </header>;
}
function Footer({tab,space}:{tab:UnifiedTab;space:PinerSpace}){
 return <nav aria-label="Điều hướng Piner Space" data-piner-shared="bottom-nav" className={css.unifiedNav}>
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
 const [status,setStatus]=useState("");
 const focusReturn=useRef<HTMLElement|null>(null);
 const previewReturn=useRef<HTMLElement|null>(null);

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
 const loaded=profileReady&&visibilityReady;
 const all:MediaPost[]=loaded?[...POSTS].filter(p=>isInSpace(p,space)).map(p=>({...p,visibility:overrides[p.id]??p.visibility})).sort(dateSort):[];
 const own=all.filter(p=>p.ownerId===(space==="mytime"?"mai":activeId));
 const visible=tab==="community"?all.filter(p=>p.visibility==="community"):own;
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
  setStatus(next==="community"?"Đã chia sẻ trong phiên demo. Bản Public local chưa đồng bộ thay đổi chia sẻ.":(isPublicFixture(shareIntent.id)?"Đã thu hồi trong phiên demo. Bản Public local vẫn là dữ liệu mẫu tĩnh.":"Đã thu hồi chia sẻ trong phiên demo."));
  restoreFocus();
 };
   const title=TABS.find(item=>item.id===tab)?.label??"Bảng tin";
 return <div className={css.unifiedBackdrop}>
   <div className={css.unifiedShell} data-piner-shared="unified-shell" data-unified-tab={tab} data-piner-space={space}>
           <Header currentChild={activeId} select={select} space={space}/>
     <main className={tab==="home"?css.unifiedContent+" "+css.unifiedHomeContent:css.unifiedContent} data-piner-slot="content" data-hydrated={loaded?"true":"false"}>
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
           <Footer tab={tab} space={space}/>
     {preview&&(preview.type==="reel"
       ?<ReelViewer post={all.find(p=>p.id===preview.id)??preview} onClose={closePreview}/>
       :<PreviewDialog post={all.find(p=>p.id===preview.id)??preview} onClose={closePreview}
         onRequestVisibility={requestVisibility}/>)}
     {shareIntent&&<VisibilityDialog post={shareIntent} onCancel={()=>{setShareIntent(null);restoreFocus();}}
       onConfirm={confirmVisibility}/>}
   </div>
 </div>;
}
