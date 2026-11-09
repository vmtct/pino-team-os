"use client";
// PAP-1764 · Shared PINO member media shell; all content is synthetic and read-only.
// TOS PAP-934 geometry: max430px frame, 60px headers, 76px bottom nav and 44px hit targets.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AppGlyph } from "./AppGlyph";
import { MediaArtwork } from "./MediaArtwork";
import { PINER_APPS,type PinerApp,type PinerAppKey } from "./catalog";
import { APP_NAV,getTabHref,type NavIcon } from "./navigation";
import { postsFor,type MediaPost,type MediaType,type Visibility } from "./media";
import { VisibilityDialog } from "./VisibilityDialog";
import { MANAGED_CHILDREN,getProfile,isManagedChild,useActiveProfile } from "./profiles";
import css from "./launcher.module.css";

export function Glyph({name}:{name:NavIcon}){
 const root={width:22,height:22,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:1.8,strokeLinecap:"round" as const,strokeLinejoin:"round" as const,"aria-hidden":true as const};
 if(name==="home")return <svg {...root}><path d="m3 10 9-7 9 7v10h-7v-6H9v6H3Z"/></svg>;
 if(name==="grid")return <svg {...root}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
 if(name==="video")return <svg {...root}><rect x="3" y="3" width="18" height="18" rx="4"/><path d="m10 8 6 4-6 4z"/></svg>;
 return <svg {...root}><path d="M4 21v-3a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v3"/><circle cx="12" cy="7" r="4"/><path d="M2 8h2m16 0h2"/></svg>;
}
export function PhoneFrame({theme,children}:{theme:PinerAppKey|"home";children:React.ReactNode}){
 return <div className={css.backdrop}><div className={css.phone} data-piner-shared="phone-frame" data-piner-theme={theme}>{children}</div></div>;
}
// PAP-1774 · App-first home, native profile select, zero secondary chrome.
function ProfilePicker(){
 const {activeId,profile,select}=useActiveProfile();
 return <section className={css.familySwitcher} data-piner-slot="profile-switcher" aria-label="Chuyển hồ sơ học viên">
   <label htmlFor="piner-child-profile">Đang xem</label>
   <div className={css.familyPicker}>
     <span className={css.familyInitial} aria-hidden="true">{profile.avatar}</span>
     <select id="piner-child-profile" className={css.familySelect} value={activeId}
       aria-label="Chọn con đang xem" onChange={event=>select(event.target.value as typeof activeId)}>
       {MANAGED_CHILDREN.map(child=><option key={child.id} value={child.id}>{child.display}</option>)}
     </select>
     <span className={css.familyChevron} aria-hidden="true">⌄</span>
   </div>
 </section>;
}
export function PinerHome(){
 return <PhoneFrame theme="home">
  <header className={css.header} data-piner-shared="home-header">
    <div className={css.brand}>
      <span className={css.brandMark} aria-hidden="true">P</span>
      <div><small>PINO HOUSE</small><h1>Piner Space</h1></div>
    </div>
  </header>
  <main className={css.minimalHome} data-piner-home="minimal">
    <ProfilePicker/>
    <nav className={css.focusAppGrid} data-piner-slot="app-grid" aria-label="Ứng dụng Piner Space">
      {PINER_APPS.map(app=><Link key={app.id} href={app.href} data-app={app.id}
        aria-label={"Mở "+app.label} className={css.focusAppTile}>
        <span className={css.focusAppIcon} data-icon-theme={app.color}><AppGlyph kind={app.id}/></span>
        <strong>{app.label}</strong>
      </Link>)}
    </nav>
  </main>
 </PhoneFrame>;
}
function AppHeader({app,profileName}:{app:PinerApp;profileName:string}){
 return <header className={css.header} data-piner-shared="app-header"><div className={css.brand}><span className={css.smallIcon}><AppGlyph kind={app.id}/></span><div><strong>{app.label}</strong><small>ĐANG XEM · {profileName}</small></div></div>
  <Link href="/piner" className={css.homeAction} aria-label="Về Piner Space"><Glyph name="home"/></Link>
 </header>;
}
function BottomNav({app,active}:{app:PinerApp;active:string}){
 return <nav data-piner-shared="bottom-nav" data-nav-app={app.id} aria-label={"Điều hướng "+app.label} className={css.bottomNav}>
  {APP_NAV[app.id].map(tab=><Link key={tab.id} data-tab={tab.id} aria-current={active===tab.id?"page":undefined} className={active===tab.id?css.navActive:css.navItem} href={getTabHref(app.id,tab.id)}>
   <span><Glyph name={tab.icon}/></span><small>{tab.label}</small>
  </Link>)}
 </nav>;
}
function TeacherComment({post}:{post:MediaPost}){return <div className={css.teacherComment}><span className={css.teacherIcon}>✎</span><div><strong>{post.teacher}</strong><p>{post.comment}</p></div></div>}
export function PostCard({post,onOpen,onRequestVisibility,scope="personal"}:{post:MediaPost;onOpen:(post:MediaPost)=>void;onRequestVisibility:(post:MediaPost)=>void;scope?:"personal"|"community"}){
 const [commentsOpen,setCommentsOpen]=useState(false);const [liked,setLiked]=useState(false);
 const community=post.visibility==="community";
 const canManage=isManagedChild(post.ownerId);
 const author=scope==="community"?getProfile(post.ownerId).alias:(post.app==="piano"?"PINO Piano":"PINO Hội Họa");
 return <article className={css.postCard} data-post={post.id} data-post-owner={post.ownerId} data-post-scope={scope}>
  <div className={css.postHead}><span className={css.postAvatar}>{post.app==="piano"?"♫":"✿"}</span><div className={css.postMeta}><strong>{author}</strong><small>{post.date} · {scope==="community"?(post.ownerId==="mai"?"MyTime · Học viên trưởng thành":"Cộng đồng phụ huynh PINO"):"Hành trình riêng"}</small></div><span className={community?css.sharedBadge:css.privateBadge}>{community?"Đã chia sẻ":"Riêng tư"}</span></div>
  <button type="button" className={css.posterButton} onClick={()=>onOpen(post)} aria-label={"Xem "+post.title}>
   <MediaArtwork post={post}/>{post.type==="reel"&&<span className={css.reelOverlay}><span>▶</span><small>{post.duration} · Reel minh họa</small></span>}
  </button>
  <div className={css.postBody}><strong>{post.title}</strong><p>{post.caption}</p><TeacherComment post={post}/>
   <div className={css.postActions}><button onClick={()=>setLiked(v=>!v)} aria-pressed={liked} type="button">{liked?"♥":"♡"} <span>{liked?"Đã lưu":"Yêu thích"}{community?" · "+(post.reactions+(liked?1:0)):""}</span></button>
    <button type="button" onClick={()=>setCommentsOpen(v=>!v)}>▤ <span>{community?"Bình luận ("+post.responses.length+")":"Nhận xét"}</span></button>
    {canManage&&<button type="button" className={css.visibilityAction} onClick={()=>onRequestVisibility(post)} aria-label={(community?"Thu hồi chia sẻ":"Chia sẻ")+" "+post.title}>{community?"↶":"↗"} <span>{community?"Thu hồi":"Chia sẻ"}</span></button>}</div>
   {commentsOpen&&<div className={css.replyList}>{community?post.responses.map((comment,i)=><p key={i}><strong>PH PINO</strong> {comment.replace("PH PINO · ","")}</p>):<p>Nhận xét riêng chỉ dành cho gia đình và giáo viên có quyền truy cập.</p>}<small>Minh họa — không có chức năng gửi bình luận hoặc lưu dữ liệu thật.</small></div>}
  </div>
 </article>;
}
function GridView({posts,onOpen}:{posts:readonly MediaPost[];onOpen:(post:MediaPost)=>void}){
 const [filter,setFilter]=useState<"all"|MediaType>("all");const visible=posts.filter(p=>filter==="all"||p.type===filter);
 return <><div className={css.sectionHead}><h2>Bộ sưu tập</h2><span>{visible.length} mục</span></div><div className={css.filterRow} role="group" aria-label="Lọc bộ sưu tập">
  {([["all","Tất cả"],["photo","Ảnh"],["reel","Reels"]] as const).map(([key,name])=><button key={key} type="button" aria-pressed={filter===key} onClick={()=>setFilter(key)} className={filter===key?css.filterActive:css.filter}>{name}</button>)}
 </div>{visible.length===0?<div className={css.emptyMedia}><strong>Chưa có nội dung phù hợp</strong><p>Hãy chọn bộ lọc khác để xem thêm tác phẩm.</p></div>:<div className={css.galleryGrid} data-gallery-view="grid">{visible.map(p=><button className={css.galleryTile} type="button" key={p.id} onClick={()=>onOpen(p)} aria-label={"Xem "+p.title}><MediaArtwork post={p}/>{p.type==="reel"&&<span>▶ {p.duration}</span>}</button>)}</div>}</>;
}
function ReelsView({posts,onOpen}:{posts:readonly MediaPost[];onOpen:(post:MediaPost)=>void}){
 return <><div className={css.sectionHead}><h2>Reels</h2><span>Video</span></div><p className={css.sectionNote}>Những khoảnh khắc sáng tạo và biểu diễn. Video đang ở dạng thumbnail minh họa.</p>
 {posts.some(p=>p.type==="reel")?<div className={css.reelsGrid}>{posts.filter(p=>p.type==="reel").map(p=><button type="button" className={css.reelTile} key={p.id} onClick={()=>onOpen(p)} aria-label={"Xem "+p.title}>
 <MediaArtwork post={p}/><span className={css.playDisc}>▶</span><span className={css.reelCaption}><strong>{p.title}</strong><small>◷ {p.duration} · Xem chi tiết</small></span></button>)}</div>:<div className={css.emptyMedia}><strong>Chưa có Reel nào</strong><p>Khoảnh khắc biểu diễn và sáng tạo sẽ được lưu tại đây.</p></div>}</>;
}
function CommunityView({posts,onOpen,onRequestVisibility}:{posts:readonly MediaPost[];onOpen:(post:MediaPost)=>void;onRequestVisibility:(post:MediaPost)=>void}){
 const community=posts.filter(p=>p.visibility==="community");
 return <><div className={css.communityIntro}><strong>Góc cộng đồng PINO ♡</strong><p>Các tác phẩm được gia đình chọn chia sẻ. Những bài riêng tư không xuất hiện ở đây.</p><span>Ví dụ minh họa · cần đồng ý chia sẻ khi triển khai thật</span></div>
 <div className={css.feedList}>{community.map(p=><PostCard key={p.id} post={p} scope="community" onOpen={onOpen} onRequestVisibility={onRequestVisibility}/>)}</div></>;
}
export function PreviewDialog({post,onClose,onRequestVisibility}:{post:MediaPost;onClose:()=>void;onRequestVisibility:(post:MediaPost)=>void}){
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==="Escape")onClose()};document.addEventListener("keydown",key);return()=>document.removeEventListener("keydown",key)},[onClose]);
 return <div className={css.modalBackdrop} role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className={css.modal} role="dialog" aria-modal="true" aria-label={"Xem "+post.title}>
 <header><strong>{post.title}</strong><button autoFocus type="button" onClick={onClose} aria-label="Đóng">✕</button></header>
 <div className={css.modalMedia}><MediaArtwork post={post}/>{post.type==="reel"&&<span className={css.modalVideo}>▶ Video minh họa — chưa có video thật</span>}</div>
 {post.visibility==="community"&&<p className={css.modalAuthor}>Tác giả: <strong>{getProfile(post.ownerId).alias}</strong></p>}
 <p>{post.caption}</p><TeacherComment post={post}/>
 {isManagedChild(post.ownerId)&&<button type="button" className={css.modalShareAction} onClick={()=>onRequestVisibility(post)} aria-label={(post.visibility==="private"?"Chia sẻ":"Thu hồi chia sẻ")+" "+post.title}>
   {post.visibility==="private"?"↗ Chia sẻ với phụ huynh PINO":"↶ Thu hồi chia sẻ"}
 </button>}
 <small className={css.modalFoot}>Fixture tổng hợp · Không dùng ảnh hoặc dữ liệu học viên thật.</small></section></div>;
}
export function PinerAppScreen({app,tab}:{app:PinerApp;tab:string}){
 const {profile}=useActiveProfile();
 const [preview,setPreview]=useState<MediaPost|null>(null);
 const [shareIntent,setShareIntent]=useState<MediaPost|null>(null);
 const focusReturnRef=useRef<HTMLElement|null>(null);
 const [visibilityOverrides,setVisibilityOverrides]=useState<Record<string,Visibility>>({});
 const [hydrated,setHydrated]=useState(false);
 const [statusMessage,setStatusMessage]=useState("");
 useEffect(()=>{
   const appPosts=postsFor(app.id);
   const allowed=new Set(appPosts.map(post=>post.id));
   const restored:Record<string,Visibility>={};
   try{
     const raw=window.sessionStorage.getItem("piner-pap1765-visibility-"+app.id);
     if(raw){
       const candidate=JSON.parse(raw) as Record<string,unknown>;
       if(candidate && typeof candidate==="object" && !Array.isArray(candidate)){
         for(const [id,value] of Object.entries(candidate)){
           if(allowed.has(id) && (value==="private" || value==="community"))restored[id]=value;
         }
       }
     }
   }catch{ /* Session storage can be blocked: prototype still works in-memory. */ }
   setVisibilityOverrides(restored);
   setHydrated(true);
 },[app.id]);
 const all=postsFor(app.id).map(post=>({
   ...post,visibility:hydrated?(visibilityOverrides[post.id]??post.visibility):post.visibility
 }));
 const own=all.filter(post=>post.ownerId===profile.id);
 const restoreShareFocus=()=>requestAnimationFrame(()=>{
   if(focusReturnRef.current?.isConnected)focusReturnRef.current.focus();
   else document.querySelector<HTMLAnchorElement>('a[aria-label="Về Piner Space"],[data-piner-shared="bottom-nav"] a[aria-current="page"]')?.focus();
 });
 const onCancelVisibility=()=>{setShareIntent(null);restoreShareFocus();};
 const onRequestVisibility=(post:MediaPost)=>{
   if(!isManagedChild(post.ownerId))return;
   focusReturnRef.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
   setPreview(null);setShareIntent(post);setStatusMessage("");
 };
 const onConfirmVisibility=()=>{
   if(!shareIntent || !isManagedChild(shareIntent.ownerId))return;
   const visibility:Visibility=shareIntent.visibility==="private"?"community":"private";
   const updated={...visibilityOverrides,[shareIntent.id]:visibility};
   setVisibilityOverrides(updated);
   try{window.sessionStorage.setItem("piner-pap1765-visibility-"+app.id,JSON.stringify(updated));}
   catch{ /* No backend; this is ephemeral prototype-only state. */ }
   setStatusMessage(visibility==="community"
     ?"Đã chia sẻ với Cộng đồng phụ huynh PINO (mô phỏng)."
     :"Đã thu hồi chia sẻ. Bài đăng đã trở lại Riêng tư (mô phỏng).");
   setShareIntent(null);
   setPreview(null);
   restoreShareFocus();
 };
 const title=tab==="home"?"Bảng tin":tab==="grid"?"Bộ sưu tập":tab==="reels"?"Reels":"Cộng đồng";
 return <PhoneFrame theme={app.id}><AppHeader app={app} profileName={profile.display}/>
  <main className={css.appContent} data-piner-slot="app-content" data-active-tab={tab}>
   <div className={css.appLead}><div><small>{app.eyebrow} · {tab==="community"?"CỘNG ĐỒNG PINO":profile.display.toUpperCase()}</small><h1>{title}</h1><p>{tab==="home"?app.experience:tab==="grid"?"Mỗi tác phẩm là một dấu mốc.":tab==="reels"?"Lưu lại chuyển động và giai điệu.":"Cùng chia sẻ niềm vui với PINO."}</p></div><span><AppGlyph kind={app.id}/></span></div>
   {statusMessage&&<p className={css.visibilityStatus} role="status">{statusMessage}</p>}
   {tab==="home"&&<><div className={css.sectionHead}><h2>Khoảnh khắc gần đây</h2><span>Mới nhất</span></div><div className={css.feedList}>{own.map(p=><PostCard key={p.id} post={p} onOpen={setPreview} onRequestVisibility={onRequestVisibility}/>)}</div></>}
   {tab==="grid"&&<GridView posts={own} onOpen={setPreview}/>}
   {tab==="reels"&&<ReelsView posts={own} onOpen={setPreview}/>}
   {tab==="community"&&<CommunityView posts={all} onOpen={setPreview} onRequestVisibility={onRequestVisibility}/>}
   <p className={css.prototypeNote}>Prototype PINO · Chỉ sử dụng dữ liệu minh họa, chưa kết nối Core.</p>
  </main><BottomNav app={app} active={tab}/>
  {preview&&<PreviewDialog post={all.find(p=>p.id===preview.id)??preview} onClose={()=>setPreview(null)} onRequestVisibility={onRequestVisibility}/>}
  {shareIntent&&<VisibilityDialog post={shareIntent} onCancel={onCancelVisibility} onConfirm={onConfirmVisibility}/>}
 </PhoneFrame>;
}
