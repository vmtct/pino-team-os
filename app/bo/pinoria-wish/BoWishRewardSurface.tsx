"use client";
/** PAP-2135 / PAP-2061 — immutable reward context, never a separate BO Item master. */
import {useCallback} from "react";
import {BoQuickView} from "@/app/bo/components/registration/BoQuickView";
import {DetailFrame} from "@/app/components/workspace-renderer/DetailFrame";
import {PropertySections} from "@/app/components/workspace-renderer/Properties";
import {HoWishItemPreview} from "@/app/ho/pinoria/wish-banners/HoWishItemPreview";
import type {WishItemPreviewSource} from "@/app/ho/pinoria/wish-banners/wish-item-preview";
export type BoWishRewardSource=(event:BoWishDetail,ordinal:number,target:Parameters<WishItemPreviewSource>[0],signal:AbortSignal)=>ReturnType<WishItemPreviewSource>;
import type {BoWishDetail} from "@/lib/pls-wish-bo-contract";
import {wishOutcomeModule,wishOutcomeRows} from "./wish-event-view";
export type RewardSurfaceMode="view"|"preview"|"detail"|"detail-preview";
export function BoWishRewardSurface({event,ordinal,mode,setMode,load,onClose}:{event:BoWishDetail;ordinal:number;mode:RewardSurfaceMode;setMode:(mode:RewardSurfaceMode)=>void;load:BoWishRewardSource;onClose:()=>void}){
 const o=event.outcomes.find(x=>x.ordinal===ordinal),row=wishOutcomeRows(event).find(x=>x.ordinal===ordinal);
 const loadPreview=useCallback<WishItemPreviewSource>((target,signal)=>load(event,ordinal,target,signal),[event,ordinal,load]);
 if(!o||!row)return null;
 const target={itemId:o.itemId,revision:o.itemRevision};
 const rewardModule={...wishOutcomeModule,label:"Wish Events / Item",fields:[...wishOutcomeModule.fields,{key:"itemId",label:"Item ID",type:"id" as const,w:270,icon:"Aa",readonly:true}]};
 if(mode==="preview"||mode==="detail-preview")return <HoWishItemPreview target={target} load={loadPreview} path="Wish Events / Item" onClose={()=>setMode(mode==="preview"?"view":"detail")}/>;
 if(mode==="detail")return <DetailFrame title={row.name} subtitle="Wish Event · Item" onBack={onClose} tabs={[{id:"overview",label:"Tổng quan"}]} selected="overview" actions={<button type="button" className="secondary-btn" onClick={()=>setMode("detail-preview")}>Xem ảnh Item</button>}><PropertySections variant="detail" fields={rewardModule.fields} record={row} sections={[{id:"reward",label:"Item đã nhận",fields:rewardModule.fields.map(f=>f.key)}]} canEdit={()=>false}/></DetailFrame>;
 return <BoQuickView module={rewardModule} record={row} onClose={onClose} onDetail={()=>setMode("detail")} extraSection={<button type="button" className="secondary-btn" onClick={()=>setMode("preview")}>Xem ảnh Item</button>}/>;
}
