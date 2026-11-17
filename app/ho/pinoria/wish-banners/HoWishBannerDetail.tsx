"use client";
/** PAP-2030 / PNR-WISH — feature-local detail body, shared DS shell and table; not route admission. */
import {useRef,useState,type ReactNode} from "react";
import {DetailFrame} from "@/app/components/workspace-renderer/DetailFrame";
import {BoDataTable} from "@/app/bo/components/registration/BoDataTable";
import {BoValue} from "@/app/bo/components/registration/BoValue";
import {defaultTable,type BoRecord} from "@/lib/bo-registration";
import {confirmSavedWishDraft,type BannerValue,type WishConfigHead} from "@/lib/pls-wish-ho-contract";
import {bannerView,wishBannerModule,wishBannerItemModule} from "./wish-banner-view";
import {HoWishItemPreview} from "./HoWishItemPreview";
import type {WishItemPreviewSource,WishItemPreviewTarget} from "./wish-item-preview";
import {BannerDraftOverview,BannerDraftItems} from "./HoWishBannerDraftEditor";
import {bannerEdit,bannerEditCurrent,bannerEditCommand,publishedWishItems,type BannerEdit,type PublishedWishItem} from "./wish-banner-edit";
type Props={loadItemPreview?:WishItemPreviewSource;saveDraft?:(command:ReturnType<typeof bannerEditCommand>)=>Promise<{receipt:unknown;readback:unknown}>;onSaved?:()=>void;items?:readonly PublishedWishItem[];centerLabels?:Readonly<Record<string,string>>;head:WishConfigHead<BannerValue>;selection:"published"|"pending";centerLabel:string|null;onBack:()=>void;mobileMenu?:ReactNode;actions?:ReactNode;onItemPreview?:(item:{itemId:string;revision:number})=>void};
function ItemLedger({rows,onPreview}:{rows:BoRecord[];onPreview?:Props["onItemPreview"]}){
 const [table,setTable]=useState(()=>defaultTable(wishBannerItemModule.fields)),[page,setPage]=useState(1);
 return <section aria-label="Item ledger">
  <p className="settings-hint">Tỷ trọng tương đối trong pool, không phải xác suất Wish. Rarity chỉ có khi Core đã xác nhận phiên bản.</p>
  <BoDataTable module={wishBannerItemModule} rows={rows} loadState="ready" value={table} update={next=>{setTable(s=>({...s,...next}));setPage(1)}} page={page} setPage={setPage}
    onOpen={r=>{if(onPreview&&typeof r.itemRevision==="number")onPreview({itemId:r.id,revision:r.itemRevision})}} openEnabled={!!onPreview}
    onSettings={()=>{}} filterOpen={false} setFilterOpen={()=>{}} views={[]} changeViews={()=>{}} activeView={null} applyView={()=>{}} reset={()=>{setTable(defaultTable(wishBannerItemModule.fields));setPage(1)}} undo={()=>{}} canUndo={false} legacyStyles minimal showChrome={false}/>
 </section>;
}
export function HoWishBannerDetail({head,selection,centerLabel,onBack,mobileMenu,onItemPreview,actions,saveDraft,onSaved,items,centerLabels,loadItemPreview}:Props){
 const [tab,setTab]=useState("overview"),v=bannerView(head,selection,centerLabel);
 const [preview,setPreview]=useState<WishItemPreviewTarget|null>(null);
 const [draft,setDraft]=useState<BannerEdit|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false);
 const flight=useRef(false);
 let choices:PublishedWishItem[]|null=null;try{if(items)choices=publishedWishItems(items);}catch{/* Malformed source must not admit editing. */}
 const conflicted=!!draft&&!bannerEditCurrent(draft,head);
 const canEdit=!!saveDraft&&!!onSaved&&choices!==null&&!!centerLabels&&!head.staleDraft&&!uncertain&&!conflicted;
 function start(){try{setDraft(bannerEdit(head));setTab("overview");setError("");}catch(e){setError(e instanceof Error?e.message:"Không thể sửa Banner.");}}
 async function submit(){
  if(!draft||!canEdit||!saveDraft||!onSaved||flight.current)return;
  let cmd:ReturnType<typeof bannerEditCommand>;try{cmd=bannerEditCommand(draft,head);}catch(e){setError(e instanceof Error?e.message:"Dữ liệu chưa hợp lệ.");return;}
  flight.current=true;setBusy(true);setError("");
  try{const r=await saveDraft(cmd);confirmSavedWishDraft(cmd,r.receipt,r.readback);setDraft(null);onSaved();}
  catch(e){setUncertain(true);setError((e instanceof Error?e.message:"Chưa xác minh được bản nháp.")+" Tải lại để đối soát.");}
  finally{flight.current=false;setBusy(false);}
 }
 const editor=draft&&{draft,onChange:setDraft,disabled:busy||!canEdit,items:choices??[],centerLabels:centerLabels??{}};
 return <DetailFrame title={v.row.name} subtitle={v.row.id} onBack={()=>{if(!flight.current&&!draft&&!uncertain)onBack();}} mobileMenu={mobileMenu}
  tabs={[{id:"overview",label:"Tổng quan"},{id:"items",label:"Item"},{id:"history",label:"Lịch sử"}]} selected={tab} onSelect={setTab}>
 {!draft&&!uncertain&&actions}
 {canEdit&&!draft&&<button type="button" className="secondary-btn" onClick={start}>Sửa bản nháp</button>}
 {draft&&<p role="status">Bản nháp riêng; phiên bản đã publish không thay đổi.</p>}
 {editor&&tab==="overview"?<BannerDraftOverview {...editor}/>:editor&&tab==="items"?<BannerDraftItems {...editor}/>:tab==="overview"?<section className="v24-prop-section"><div className="v24-section-heading"><h4>Thông tin chính</h4></div><div className="v24-prop-grid">
  {wishBannerModule.fields.map(f=><div key={f.key} className="v24-prop-item"><div className="v24-prop-key"><span className="v24-field-glyph">{f.icon}</span>{f.label}</div><div className="v24-prop-value readonly" aria-label={"Chỉ đọc "+f.label}><BoValue field={f} value={v.row[f.key]} full/></div></div>)}
 </div></section>:tab==="items"?<ItemLedger key={head.recordId+":"+selection+":"+v.row.version} rows={v.itemRows} onPreview={loadItemPreview?setPreview:onItemPreview}/>:<p role="status" className="v24-audit-empty">Lịch sử chi tiết chưa khả dụng.</p>}
 {conflicted&&<p role="alert">Banner đã thay đổi. Hủy bản nháp cục bộ trước khi sửa lại.</p>}
 {error&&<p role="alert">{error}</p>}
 {draft&&<div className="heading-actions">{uncertain?<button type="button" className="primary-btn" disabled={busy} onClick={onSaved}>Tải lại để đối soát</button>:<><button type="button" className="secondary-btn" disabled={busy} onClick={()=>{setDraft(null);setError("");}}>Hủy</button><button type="button" className="primary-btn" disabled={busy||!canEdit} onClick={()=>void submit()}>{busy?"Đang lưu…":"Lưu bản nháp"}</button></>}</div>}
 {preview&&loadItemPreview&&<HoWishItemPreview key={preview.itemId+":"+preview.revision} target={preview} load={loadItemPreview} onClose={()=>setPreview(null)}/>}
 </DetailFrame>;
}
