"use client";
/** PAP-2032 / PNR-WISH — Center-pinned native BO catalog, server cursor, no route admission. */
import {useEffect,useState,type ReactNode} from "react";
import {BoDataTable} from "@/app/bo/components/registration/BoDataTable";
import {BoTableSettings,type BoSavedView} from "@/app/bo/components/registration/BoTableSettings";
import {defaultTable,type BoRecord} from "@/lib/bo-registration";
import {parseBoWishList,parseBoWishDetail,type BoWishEvent,type BoWishDetail} from "@/lib/pls-wish-bo-contract";
import {readWishDetailRoute,wishDetailUrl,type WishDetailTab,type WishRewardRef} from "@/lib/pls-wish-detail-route";
import type {BoWishRewardSource} from "./BoWishRewardSurface";
import {wishEventModule,wishEventRow} from "./wish-event-view";
import {BoWishEventView,BoWishEventDetail,type WishInvalidationHost} from "./BoWishEventDetail";
type Cursor={createdAt:string;eventId:string};
type Props={centerId:string;load:(scope:{centerId:string;limit:number;before?:Cursor},signal:AbortSignal)=>Promise<unknown>;loadDetail:(scope:{centerId:string;eventId:string},signal:AbortSignal)=>Promise<unknown>;invalidate?:WishInvalidationHost;mobileMenu?:ReactNode;loadRewardPreview?:BoWishRewardSource};
const limit=50;
export function BoWishEventCatalog(p:Props){return <Catalog key={p.centerId} {...p}/>;}
function Catalog({centerId,load,loadDetail,invalidate,mobileMenu,loadRewardPreview}:Props){
 const [rows,setRows]=useState<BoWishEvent[]>([]),[loading,setLoading]=useState("loading"),[error,setError]=useState(""),[epoch,setEpoch]=useState(0);
 const [cursors,setCursors]=useState<(Cursor|undefined)[]>([undefined]),before=cursors[cursors.length-1];
 const [active,setActive]=useState<{id:string;mode:"view"|"detail"}|null>(null),[detail,setDetail]=useState<BoWishDetail|null>(null),[detailError,setDetailError]=useState("");
 const [table,setTable]=useState(()=>defaultTable(wishEventModule.fields)),[page,setPage]=useState(1),[filter,setFilter]=useState(false),[settings,setSettings]=useState(""),[views,setViews]=useState<BoSavedView[]>([]),[view,setView]=useState<string|null>(null);
 const [opener,setOpener]=useState<HTMLElement|null>(null),[detailTab,setDetailTab]=useState<WishDetailTab>("overview"),[routeError,setRouteError]=useState(""),[rewardRoute,setRewardRoute]=useState<WishRewardRef|null>(null);
 useEffect(()=>{const restore=()=>{try{const r=readWishDetailRoute(window.location.search,"event",centerId);setRouteError("");setDetailError("");setDetail(null);setActive(r?{id:r.record,mode:"detail"}:null);setDetailTab(r?.tab??"overview");setRewardRoute(r?.reward??null);if(r)setEpoch(x=>x+1);}catch(e){setActive(null);setDetail(null);setRewardRoute(null);setRouteError(e instanceof Error?e.message:"Liên kết không hợp lệ.");}};const timer=window.setTimeout(restore,0);window.addEventListener("popstate",restore);return()=>{window.clearTimeout(timer);window.removeEventListener("popstate",restore);};},[centerId]);
 function clearRoute(){setRewardRoute(null);window.history.pushState(null,"",wishDetailUrl(window.location.href,"event",null));setRouteError("");}
 function openDetail(id:string){setRewardRoute(null);window.history.pushState(null,"",wishDetailUrl(window.location.href,"event",{record:id,tab:"overview",centerId}));setDetail(null);setDetailError("");setDetailTab("overview");setActive({id,mode:"detail"});}
 function selectTab(tab:WishDetailTab){if(!active||active.mode!=="detail")return;window.history.pushState(null,"",wishDetailUrl(window.location.href,"event",{record:active.id,tab,centerId}));setDetailTab(tab);setRewardRoute(null);}
 function selectReward(reward:WishRewardRef|null){if(!active||active.mode!=="detail"||detailTab!=="items")return;window.history.pushState(null,"",wishDetailUrl(window.location.href,"event",{record:active.id,tab:"items",centerId,...(reward?{reward}:{})}));setRewardRoute(reward);}
 useEffect(()=>{const c=new AbortController();void load({centerId,limit,before},c.signal).then(raw=>parseBoWishList(raw,{centerId},limit,before)).then(next=>{if(!c.signal.aborted){setRows(next);setLoading("ready");setError("");}}).catch(e=>{if(!c.signal.aborted){setRows([]);setLoading("error");setError(e instanceof Error?e.message:"Không thể tải Wish Events.");}});return()=>c.abort();},[centerId,load,before,epoch]);
 const detailId=active?.mode==="detail"?active.id:null;
 useEffect(()=>{if(!detailId)return;const c=new AbortController();void loadDetail({centerId,eventId:detailId},c.signal).then(raw=>parseBoWishDetail(raw,centerId,detailId)).then(next=>{if(!c.signal.aborted){setDetail(next);setDetailError("");}}).catch(e=>{if(!c.signal.aborted){setDetail(null);setDetailError(e instanceof Error?e.message:"Không thể tải Event.");}});return()=>c.abort();},[centerId,detailId,loadDetail,epoch]);
 function reload(){setLoading("loading");setRows([]);setDetail(null);setDetailError("");setEpoch(x=>x+1);}
 function navigate(next:(Cursor|undefined)[]){setCursors(next);setLoading("loading");setRows([]);setPage(1);setActive(null);}
 function close(){clearRoute();setActive(null);setDetail(null);requestAnimationFrame(()=>opener?.focus({preventScroll:true}));}
 function open(r:BoRecord){if(routeError||loading!=="ready"||!rows.some(x=>x.eventId===r.id))return;setOpener(document.activeElement instanceof HTMLElement?document.activeElement:null);setActive({id:r.id,mode:"view"});}
 const selected=active?rows.find(x=>x.eventId===active.id):null;
 function back(){clearRoute();setDetail(null);setDetailError("");setActive(null);requestAnimationFrame(()=>opener?.focus({preventScroll:true}));}
 if(active?.mode==="detail")return detail&&detail.eventId===active.id?<BoWishEventDetail key={active.id} event={detail} detailTab={detailTab} onDetailTab={selectTab} rewardRoute={rewardRoute} onRewardRoute={selectReward} mobileMenu={mobileMenu} onBack={back} onReload={reload} invalidate={invalidate} loadRewardPreview={loadRewardPreview} onVerified={next=>{setDetail(next);setRows(r=>r.map(x=>x.eventId===next.eventId?next:x));}}/>:<section><div className="page-heading"><h1>Wish Event</h1><button type="button" className="secondary-btn" onClick={back}>Quay lại</button></div>{detailError?<><p role="alert">{detailError}</p><button type="button" className="secondary-btn" onClick={reload}>Tải lại</button></>:<p role="status">Đang tải chi tiết…</p>}</section>;
 const projected=rows.map(wishEventRow);
 return <section id="list-screen"><div className="page-heading"><div className="page-heading-left">{mobileMenu}<h1>Wish Events</h1></div><div className="heading-actions"><button type="button" className="secondary-btn" disabled={loading==="loading"} onClick={reload}>Tải lại</button></div></div>
 {error&&<p role="alert">{error}</p>}{routeError&&<p role="alert">{routeError} <button type="button" className="secondary-btn" onClick={clearRoute}>Về danh sách</button></p>}
 <p className="settings-hint">Bộ lọc áp dụng trên lô dữ liệu đang hiển thị (tối đa {limit} sự kiện).</p>
 <BoDataTable module={wishEventModule} rows={loading==="ready"?projected:[]} loadState={loading} value={table} update={p=>{setTable(s=>({...s,...p}));setPage(1);}} page={page} setPage={setPage} onOpen={open} selected={active?.id} onSettings={setSettings} filterOpen={filter} setFilterOpen={setFilter} views={views} changeViews={setViews} activeView={view} applyView={v=>{setTable(v?.state??defaultTable(wishEventModule.fields));setView(v?.id??null);setPage(1);}} reset={()=>{setTable(defaultTable(wishEventModule.fields));setPage(1);}} undo={()=>{}} canUndo={false}/>
 <div className="heading-actions" aria-label="Các lô Wish Events"><button type="button" className="secondary-btn" disabled={cursors.length===1||loading==="loading"||!!active} onClick={()=>navigate(cursors.slice(0,-1))}>Lô trước</button><span>Lô {cursors.length}</span><button type="button" className="secondary-btn" disabled={loading!=="ready"||rows.length!==limit||!!active} onClick={()=>{const last=rows.at(-1);if(last)navigate([...cursors,{createdAt:last.createdAt,eventId:last.eventId}]);}}>Lô sau</button></div>
 {settings&&<BoTableSettings screen={settings} setScreen={setSettings} onClose={()=>setSettings("")} fields={wishEventModule.fields} rows={projected} value={table} update={p=>{setTable(s=>({...s,...p}));setPage(1);}} views={views} setViews={setViews} applyView={v=>{setTable(v.state);setView(v.id);setPage(1);setSettings("");}}/>}
 {selected&&active?.mode==="view"&&<BoWishEventView event={selected} onClose={close} onDetail={()=>openDetail(selected.eventId)}/>}
 </section>;
}
