"use client";
/** PAP-2030 / PNR-WISH — feature-local detail body, shared DS shell and table; not route admission. */
import {useRef,useState,type ReactNode} from "react";
import wishActions from "../wish-policies/wish-detail-actions.module.css";
import type {WishDetailTab,WishRevisionRef} from "@/lib/pls-wish-detail-route";
import {DetailFrame} from "@/app/components/workspace-renderer/DetailFrame";
import {BoDataTable} from "@/app/bo/components/registration/BoDataTable";
import {BoValue} from "@/app/bo/components/registration/BoValue";
import {defaultTable,type BoRecord} from "@/lib/bo-registration";
import {confirmSavedWishDraft,type BannerValue,type WishConfigHead} from "@/lib/pls-wish-ho-contract";
import {wishRevisionRef} from "../wish-policies/wish-catalog-state";
import {bannerView,wishBannerModule,wishBannerItemModule} from "./wish-banner-view";
import {HoWishLinkedItem,type LinkedWishItemSource} from "./HoWishLinkedItem";
import type {WishItemPreviewSource,WishItemPreviewTarget} from "./wish-item-preview";
import {BannerDraftItems} from "./HoWishBannerDraftEditor";
import {bannerEdit,bannerEditCurrent,bannerEditCommand,publishedWishItems,wishLocalDate,wishUtcDate,type BannerEdit,type PublishedWishItem} from "./wish-banner-edit";
type Props={loadLinkedItem?:LinkedWishItemSource;detailTab?:WishDetailTab;onDetailTab?:(tab:WishDetailTab)=>void;loadItemPreview?:WishItemPreviewSource;saveDraft?:(command:ReturnType<typeof bannerEditCommand>)=>Promise<{receipt:unknown;readback:unknown}>;onSaved?:(next?:WishRevisionRef)=>void;items?:readonly PublishedWishItem[];centerLabels?:Readonly<Record<string,string>>;head:WishConfigHead<BannerValue>;selection:"published"|"pending";centerLabel:string|null;onBack:()=>void;mobileMenu?:ReactNode;actions?:ReactNode;onItemPreview?:(item:{itemId:string;revision:number})=>void};
function ItemLedger({rows,onPreview}:{rows:BoRecord[];onPreview?:Props["onItemPreview"]}){
 const [table,setTable]=useState(()=>defaultTable(wishBannerItemModule.fields)),[page,setPage]=useState(1);
 return <section aria-label="Item ledger">
  <p className="settings-hint">Tỷ trọng tương đối trong pool, không phải xác suất Wish. Rarity chỉ có khi Core đã xác nhận phiên bản.</p>
  <BoDataTable module={wishBannerItemModule} rows={rows} loadState="ready" value={table} update={next=>{setTable(s=>({...s,...next}));setPage(1)}} page={page} setPage={setPage}
    onOpen={r=>{if(onPreview&&typeof r.itemRevision==="number")onPreview({itemId:r.id,revision:r.itemRevision})}} openEnabled={!!onPreview}
    onSettings={()=>{}} filterOpen={false} setFilterOpen={()=>{}} views={[]} changeViews={()=>{}} activeView={null} applyView={()=>{}} reset={()=>{setTable(defaultTable(wishBannerItemModule.fields));setPage(1)}} undo={()=>{}} canUndo={false} legacyStyles minimal showChrome={false}/>
 </section>;
}
export function HoWishBannerDetail({head,selection,centerLabel,onBack,mobileMenu,onItemPreview,actions,saveDraft,onSaved,items,centerLabels,loadItemPreview,loadLinkedItem,detailTab,onDetailTab}:Props){
 const [localTab,setLocalTab]=useState<WishDetailTab>("overview"),v=bannerView(head,selection,centerLabel);
 const [preview,setPreview]=useState<WishItemPreviewTarget|null>(null),[itemMode,setItemMode]=useState<"drawer"|"detail">("drawer");
 const itemOpener=useRef<HTMLElement|null>(null);
 const [draft,setDraft]=useState<BannerEdit|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false);
 const flight=useRef(false),tab=detailTab??localTab;
 function setTab(next:string){if(next!=="overview"&&next!=="items"&&next!=="history")return;if(flight.current||preview)return;setLocalTab(next);onDetailTab?.(next);}
 let choices:PublishedWishItem[]|null=null;try{if(items)choices=publishedWishItems(items);}catch{/* Malformed source must not admit editing. */}
 const conflicted=!!draft&&!bannerEditCurrent(draft,head);
 const canEdit=!!saveDraft&&!!onSaved&&choices!==null&&!!centerLabels&&!head.staleDraft&&!uncertain&&!conflicted&&(selection==="pending"||!head.pendingDraft);
 const editBase=canEdit?(draft??bannerEdit(head)):null;
 function change(next:BannerEdit){if(!editBase||busy||!canEdit)return;if(JSON.stringify(next)===JSON.stringify(editBase))return;setDraft(next);setError("");}
 async function submit(){
  if(!draft||!canEdit||!saveDraft||!onSaved||flight.current)return;
  let cmd:ReturnType<typeof bannerEditCommand>;try{cmd=bannerEditCommand(draft,head);}catch(e){setError(e instanceof Error?e.message:"Dữ liệu chưa hợp lệ.");return;}
  flight.current=true;setBusy(true);setError("");
  try{const r=await saveDraft(cmd);const next=confirmSavedWishDraft(cmd,r.receipt,r.readback);setDraft(null);onSaved(wishRevisionRef(next,"pending"));}
  catch(e){setUncertain(true);setError((e instanceof Error?e.message:"Chưa xác minh được bản nháp.")+" Tải lại để đối soát.");}
  finally{flight.current=false;setBusy(false);}
 }
 const editor=editBase&&{draft:editBase,onChange:change,disabled:busy||!canEdit,items:choices??[],centerLabels:centerLabels??{}};
 function closeItem(){setPreview(null);setItemMode("drawer");requestAnimationFrame(()=>itemOpener.current?.focus({preventScroll:true}));}
 const previewItem=loadLinkedItem?(target:WishItemPreviewTarget)=>{if(flight.current)return;itemOpener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setItemMode("drawer");setPreview(target);}:onItemPreview;
 const linked=preview&&loadLinkedItem?<HoWishLinkedItem key={preview.itemId+":"+preview.revision} target={preview} load={loadLinkedItem} mode={itemMode} onClose={closeItem} onDetail={()=>setItemMode("detail")} mobileMenu={mobileMenu} loadMedia={loadItemPreview}/>:null;
 if(linked&&itemMode==="detail")return linked;
 return <DetailFrame title={v.row.name} subtitle={v.row.id} onBack={()=>{if(!flight.current&&!draft&&!uncertain)onBack();}} mobileMenu={mobileMenu}
  tabs={[{id:"overview",label:"Tổng quan"},{id:"items",label:"Item"},{id:"history",label:"Lịch sử"}]} selected={tab} onSelect={setTab}>

 {draft&&<p role="status">Bản nháp riêng; phiên bản đã publish không thay đổi.</p>}
 {editor&&tab==="items"?<BannerDraftItems {...editor} onPreview={previewItem}/>:tab==="overview"?<div className={wishActions.layout}><div className={wishActions.groups} data-wish-detail-groups>{[{title:"Thông tin chính",keys:["name","version","status","center","startsAt","endsAt"]},{title:"Audit",keys:["createdAt","createdByUser","updatedAt","updatedByUser"]}].map(g=><section className="v24-prop-section" key={g.title}><div className="v24-section-heading"><h4>{g.title}</h4></div><div className={wishActions.propertyColumn}>
  {wishBannerModule.fields.filter(f=>g.keys.includes(f.key)).map(f=><div key={f.key} className="v24-prop-item"><div className="v24-prop-key"><span className="v24-field-glyph">{f.icon}</span>{f.label}</div>{editBase&&f.key==="name"?<input className="edit-input" aria-label={f.label} maxLength={160} disabled={busy} value={editBase.name} onChange={e=>change({...editBase,name:e.target.value})}/>:editBase&&f.key==="center"?<select aria-label={f.label} className="edit-input" disabled={busy} value={editBase.value.centerId??""} onChange={e=>change({...editBase,value:{...editBase.value,centerId:e.target.value||null}})}><option value="">Global</option>{editBase.value.centerId&&!Object.hasOwn(centerLabels??{},editBase.value.centerId)&&<option value={editBase.value.centerId}>{centerLabel??"—"}</option>}{Object.entries(centerLabels??{}).map(([id,name])=><option value={id} key={id}>{name}</option>)}</select>:editBase&&(f.key==="startsAt"||f.key==="endsAt")?<input aria-label={f.label+" (giờ Việt Nam)"} className="edit-input" type="datetime-local" step="0.001" disabled={busy} value={wishLocalDate(editBase.value[f.key])} onChange={e=>change({...editBase,value:{...editBase.value,[f.key]:wishUtcDate(e.target.value)}})}/>:<div className="v24-prop-value readonly" aria-label={"Chỉ đọc "+f.label}><BoValue field={f} value={v.row[f.key]} full/></div>}</div>)}
 </div></section>)}</div></div>:tab==="items"?<ItemLedger key={head.recordId+":"+selection+":"+v.row.version} rows={v.itemRows} onPreview={previewItem}/>:<p role="status" className="v24-audit-empty">Lịch sử chi tiết chưa khả dụng.</p>}
 {conflicted&&<p role="alert">Banner đã thay đổi. Hủy bản nháp cục bộ trước khi sửa lại.</p>}
 {error&&<p role="alert">{error}</p>}
 {!draft&&!uncertain&&<div className={"heading-actions "+wishActions.row} data-wish-detail-actions>{actions}</div>}
 {draft&&<div className={"heading-actions "+wishActions.row} data-wish-detail-actions>{uncertain?<button type="button" className="primary-btn" disabled={busy} onClick={()=>onSaved?.()}>Tải lại để đối soát</button>:<><button type="button" className="secondary-btn" disabled={busy} onClick={()=>{setDraft(null);setError("");}}>Hủy</button><button type="button" className="primary-btn" disabled={busy||!canEdit} onClick={()=>void submit()}>{busy?"Đang lưu…":"Lưu bản nháp"}</button></>}</div>}
 {linked}
 </DetailFrame>;
}
