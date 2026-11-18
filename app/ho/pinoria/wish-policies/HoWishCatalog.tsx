"use client";
/** PAP-2030 / PNR-WISH — native catalog host, no route or permission grant. */
import {useEffect,useState,type ReactNode} from "react";
import {readWishDetailRoute,wishDetailUrl,type WishDetailTab,type WishDetailKind,type WishRevisionRef} from "@/lib/pls-wish-detail-route";
import {BoDataTable} from "@/app/bo/components/registration/BoDataTable";
import {BoTableSettings,type BoSavedView} from "@/app/bo/components/registration/BoTableSettings";
import {defaultTable,type BoModule,type BoRecord} from "@/lib/bo-registration";
import type {WishConfigHead,PolicyValue,BannerValue} from "@/lib/pls-wish-ho-contract";
import {HoWishPolicyViewDrawer} from "./HoWishPolicyViewDrawer";
import {HoWishPolicyDetail} from "./HoWishPolicyDetail";
import {HoWishBannerViewDrawer} from "../wish-banners/HoWishBannerViewDrawer";
import type {LinkedWishItemSource} from "../wish-banners/HoWishLinkedItem";
import {HoWishBannerDetail} from "../wish-banners/HoWishBannerDetail";
import {policyView,wishPolicyModule} from "./wish-policy-view";
import {bannerView,wishBannerModule} from "../wish-banners/wish-banner-view";
import {HoWishCreate} from "./HoWishCreate";
import {publishedWishItems} from "../wish-banners/wish-banner-edit";
import {HoWishLifecycle,type WishLifecycleHost} from "./HoWishLifecycle";
import type {WishItemPreviewSource} from "../wish-banners/wish-item-preview";
import type {bannerEditCommand,PublishedWishItem} from "../wish-banners/wish-banner-edit";
import type {policyEditCommand} from "./wish-policy-edit";
import {parseWishPolicies,parseWishBanners,selectWishRevision,wishRevisionRef,matchesWishRevision,type Selection} from "./wish-catalog-state";
type Common={load:(signal:AbortSignal)=>Promise<unknown>;centerLabels:Readonly<Record<string,string>>;mobileMenu?:ReactNode;lifecycle?:WishLifecycleHost};
type PolicyProps=Common&{saveDraft?:(command:ReturnType<typeof policyEditCommand>)=>Promise<{receipt:unknown;readback:unknown}>};
type BannerProps=Common&{loadLinkedItem?:LinkedWishItemSource;loadItemPreview?:WishItemPreviewSource;allocateBannerId?:()=>string;saveDraft?:(command:ReturnType<typeof bannerEditCommand>)=>Promise<{receipt:unknown;readback:unknown}>;items?:readonly PublishedWishItem[];onItemPreview?:(item:{itemId:string;revision:number})=>void};
type RenderArgs<T>={detailTab:WishDetailTab;onDetailTab:(tab:WishDetailTab)=>void;head:WishConfigHead<T>;selection:Selection;centerLabel:string|null;mode:"view"|"detail";onClose:()=>void;onDetail:()=>void;onBack:()=>void;reload:()=>void;verified:(next?:WishRevisionRef)=>void;revisionControl:ReactNode};
type CreateArgs={existing:readonly string[];onClose:()=>void;onCreated:(id:string)=>void;onReload:()=>void;bannerId:string|null};
type CatalogProps<T>=Common&{kind:Exclude<WishDetailKind,"event">;create?:(a:CreateArgs)=>ReactNode;allocateBannerId?:()=>string;module:BoModule;parse:(raw:unknown)=>WishConfigHead<T>[];centerId:(head:WishConfigHead<T>,selection:Selection)=>string|null;project:(head:WishConfigHead<T>,selection:Selection,label:string|null)=>BoRecord;render:(a:RenderArgs<T>)=>ReactNode};
function Catalog<T>({kind,load,centerLabels,mobileMenu,module,parse,centerId,project,render,create,allocateBannerId}:CatalogProps<T>){
 const [heads,setHeads]=useState<WishConfigHead<T>[]>([]),[status,setStatus]=useState("loading"),[epoch,setEpoch]=useState(0);
 const [active,setActive]=useState<{id:string;mode:"view"|"detail";selection?:Selection;version?:WishRevisionRef}|null>(null);
 const [detailTab,setDetailTab]=useState<WishDetailTab>("overview"),[routeError,setRouteError]=useState("");
 useEffect(()=>{const restore=()=>{try{const r=readWishDetailRoute(window.location.search,kind);setRouteError("");setActive(r?{id:r.record,mode:"detail",selection:r.version?.selection,version:r.version}:null);setDetailTab(r?.tab??"overview");}catch(e){setActive(null);setRouteError(e instanceof Error?e.message:"Liên kết Wish không hợp lệ.");}};const timer=window.setTimeout(restore,0);window.addEventListener("popstate",restore);return()=>{window.clearTimeout(timer);window.removeEventListener("popstate",restore);};},[kind]);
 function clearRoute(){window.history.pushState(null,"",wishDetailUrl(window.location.href,kind,null));setRouteError("");}
 function selectTab(tab:WishDetailTab){if(!active||active.mode!=="detail")return;window.history.pushState(null,"",wishDetailUrl(window.location.href,kind,{record:active.id,tab,version:active.version}));setDetailTab(tab);}
 const [table,setTable]=useState(()=>defaultTable(module.fields)),[page,setPage]=useState(1),[filter,setFilter]=useState(false),[settings,setSettings]=useState(""),[views,setViews]=useState<BoSavedView[]>([]),[view,setView]=useState<string|null>(null);
 const [opener,setOpener]=useState<HTMLElement|null>(null),[creating,setCreating]=useState<{bannerId:string|null}|null>(null),[createError,setCreateError]=useState("");
 function startCreate(){try{const id=allocateBannerId?allocateBannerId():null;if(allocateBannerId&&(!id||heads.some(h=>h.recordId===id)))throw Error("ID Banner đã tồn tại hoặc chưa hợp lệ.");setCreating({bannerId:id});setCreateError("");setOpener(document.activeElement instanceof HTMLElement?document.activeElement:null);}catch(e){setCreateError(e instanceof Error?e.message:"Không thể tạo bản nháp.");}}
 function closeCreate(){setCreating(null);requestAnimationFrame(()=>opener?.focus({preventScroll:true}));}
 function created(id:string){setCreating(null);setActive({id,mode:"view",selection:"pending"});setPage(1);reload();}
 const label=(h:WishConfigHead<T>,s:Selection)=>{const id=centerId(h,s);return id&&Object.hasOwn(centerLabels,id)?centerLabels[id]:null;};
 useEffect(()=>{
  const ctl=new AbortController();
  void load(ctl.signal).then(parse).then(rows=>{if(!ctl.signal.aborted){setHeads(rows);setStatus("ready");setActive(old=>old?.mode==="detail"||old&&rows.some(h=>h.recordId===old.id)?old:null);}}).catch(e=>{if(!ctl.signal.aborted){setHeads([]);setStatus(e instanceof Error?e.message:"Không thể tải Wish.");setActive(null);}});
  return()=>ctl.abort();
 },[load,parse,epoch]);
 function reload(){setStatus("loading");setEpoch(x=>x+1);}
 function close(){clearRoute();setActive(null);requestAnimationFrame(()=>opener?.focus({preventScroll:true}));}
 function choose(row:BoRecord){if(creating||routeError)return;const h=heads.find(x=>x.recordId===row.id);if(status!=="ready"||!h)return;setOpener(document.activeElement instanceof HTMLElement?document.activeElement:null);setActive({id:h.recordId,mode:"view",selection:selectWishRevision(h)});}
 const rows=heads.map(h=>{const s=selectWishRevision(h);return project(h,s,label(h,s));});
 const h=active&&status==="ready"?heads.find(x=>x.recordId===active.id):null;
 let rendered:ReactNode=null;
 if(h&&active&&(!active.version||matchesWishRevision(h,active.version))){const selection=active.version?.selection??selectWishRevision(h,active.selection);
 function verified(next?:WishRevisionRef){if(!next){reload();return;}if(!h||!active||active.mode!=="detail")return;let current;try{current=readWishDetailRoute(window.location.search,kind);}catch{return;}const before=wishRevisionRef(h,selection);if(!current||current.record!==h.recordId||(current.version&&(current.version.selection!==before.selection||current.version.revision!==before.revision)))return;window.history.replaceState(null,"",wishDetailUrl(window.location.href,kind,{record:h.recordId,tab:current.tab,version:next}));setActive({...active,selection:next.selection,version:next});reload();}
 function selectVersion(next:Selection){if(!h||!active)return;const version=wishRevisionRef(h,next);if(active.mode==="detail")window.history.pushState(null,"",wishDetailUrl(window.location.href,kind,{record:h.recordId,tab:detailTab,version}));setActive({...active,selection:next,version});}
 const revisionControl=<div className="heading-actions" aria-label="Phiên bản Wish">{h.published&&<button type="button" className="secondary-btn" aria-pressed={selection==="published"} onClick={()=>selectVersion("published")}>Published / Retired</button>}{h.pendingDraft&&<button type="button" className="secondary-btn" aria-pressed={selection==="pending"} onClick={()=>selectVersion("pending")}>Draft</button>}</div>;
 rendered=render({detailTab,onDetailTab:selectTab,head:h,selection,centerLabel:label(h,selection),mode:active.mode,onClose:close,onDetail:()=>{window.history.pushState(null,"",wishDetailUrl(window.location.href,kind,{record:h.recordId,tab:"overview",version:wishRevisionRef(h,selection)}));setDetailTab("overview");setActive({...active,mode:"detail",selection,version:wishRevisionRef(h,selection)});},onBack:close,reload,verified,revisionControl});}
 if(active?.mode==="detail"){if(rendered)return <>{rendered}</>;return <section><div className="page-heading"><h1>{module.label}</h1><button type="button" className="secondary-btn" onClick={close}>Về danh sách</button></div>{status==="loading"?<p role="status">Đang tải chi tiết…</p>:<p role="alert">Không tìm thấy, phiên bản đã thay đổi hoặc không được phép xem Wish Detail.</p>}</section>;}
 return <section id="list-screen"><div className="page-heading"><div className="page-heading-left">{mobileMenu}<h1>{module.label}</h1></div><div className="heading-actions"><button type="button" className="secondary-btn" disabled={status==="loading"||!!creating} onClick={reload}>Tải lại</button>{create&&<button type="button" className="primary-btn" disabled={status!=="ready"||!!creating||!!active||!!settings} onClick={startCreate}>Thêm</button>}</div></div>
 {createError&&<p role="alert">{createError}</p>}{routeError&&<p role="alert">{routeError} <button type="button" className="secondary-btn" onClick={clearRoute}>Về danh sách</button></p>}
 {status!=="ready"&&status!=="loading"&&<p role="alert">{status}</p>}
 <BoDataTable module={module} rows={status==="ready"?rows:[]} loadState={status} value={table} update={p=>{setTable(s=>({...s,...p}));setPage(1)}} page={page} setPage={setPage} onOpen={choose} selected={h?.recordId} onSettings={setSettings} filterOpen={filter} setFilterOpen={setFilter} views={views} changeViews={setViews} activeView={view} applyView={v=>{setTable(v?.state??defaultTable(module.fields));setView(v?.id??null);setPage(1)}} reset={()=>{setTable(defaultTable(module.fields));setPage(1)}} undo={()=>{}} canUndo={false} minimal legacyStyles/>
 {settings&&<BoTableSettings screen={settings} setScreen={setSettings} onClose={()=>setSettings("")} fields={module.fields} rows={rows} value={table} update={p=>{setTable(s=>({...s,...p}));setPage(1)}} views={views} setViews={setViews} applyView={v=>{setTable(v.state);setView(v.id);setPage(1);setSettings("");}}/>}
 {rendered}
 {creating&&create&&create({existing:heads.map(h=>h.recordId),bannerId:creating.bannerId,onClose:closeCreate,onCreated:created,onReload:()=>{closeCreate();reload();}})}
 </section>;
}
const policyCenter=(h:WishConfigHead<PolicyValue>)=>h.recordId;
const bannerCenter=(h:WishConfigHead<BannerValue>,s:Selection)=>(s==="published"?h.published:h.pendingDraft)?.value.centerId??null;
export function HoWishPoliciesCatalog(p:PolicyProps){return <Catalog {...p} kind="policy" module={wishPolicyModule} parse={parseWishPolicies} centerId={policyCenter} project={(h,s,l)=>policyView(h,s,l).row} create={p.saveDraft?a=><HoWishCreate scope="policy" centerLabels={p.centerLabels} existing={a.existing} save={p.saveDraft!} onClose={a.onClose} onCreated={a.onCreated} onReload={a.onReload}/>:undefined}
 render={a=>a.mode==="view"?<HoWishPolicyViewDrawer head={a.head} selection={a.selection} centerLabel={a.centerLabel} onClose={a.onClose} onDetail={a.onDetail}/>:<HoWishPolicyDetail detailTab={a.detailTab} onDetailTab={a.onDetailTab} key={a.head.recordId+":"+a.selection} head={a.head} selection={a.selection} centerLabel={a.centerLabel} onBack={a.onBack} mobileMenu={p.mobileMenu} saveDraft={p.saveDraft} onSaved={a.verified} revisionControl={a.revisionControl} lifecycle={p.lifecycle&&(!a.head.pendingDraft||a.selection==="pending")?<HoWishLifecycle scope="policy" head={a.head} execute={p.lifecycle} onVerified={a.verified} onReload={a.reload}/>:undefined}/>}/>;}
export function HoWishBannersCatalog(p:BannerProps){let choices:PublishedWishItem[]|null=null;try{if(p.items)choices=publishedWishItems(p.items);}catch{/* No create admission from malformed catalog. */}return <Catalog {...p} kind="banner" module={wishBannerModule} parse={parseWishBanners} centerId={bannerCenter} project={(h,s,l)=>bannerView(h,s,l).row} create={p.saveDraft&&p.allocateBannerId&&choices?a=>a.bannerId?<HoWishCreate scope="banner" bannerId={a.bannerId} centerLabels={p.centerLabels} items={choices!} save={p.saveDraft!} onClose={a.onClose} onCreated={a.onCreated} onReload={a.onReload}/>:null:undefined}
 render={a=>a.mode==="view"?<HoWishBannerViewDrawer head={a.head} selection={a.selection} centerLabel={a.centerLabel} onClose={a.onClose} onDetail={a.onDetail}/>:<HoWishBannerDetail detailTab={a.detailTab} onDetailTab={a.onDetailTab} key={a.head.recordId+":"+a.selection} head={a.head} selection={a.selection} centerLabel={a.centerLabel} onBack={a.onBack} mobileMenu={p.mobileMenu} onItemPreview={p.onItemPreview} loadItemPreview={p.loadItemPreview} loadLinkedItem={p.loadLinkedItem} saveDraft={p.saveDraft} onSaved={a.verified} items={p.items} centerLabels={p.centerLabels} actions={<>{a.revisionControl}{p.lifecycle&&(!a.head.pendingDraft||a.selection==="pending")&&<HoWishLifecycle scope="banner" head={a.head} execute={p.lifecycle} onVerified={a.verified} onReload={a.reload}/>}</>}/>}/>;}
