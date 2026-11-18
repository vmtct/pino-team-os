/** PAP-2030 / PNR-WISH — draft-only Banner ledger editing, no catalog authority invention. */
import {saveBannerDraft,type BannerPoolItem,type BannerValue,type WishConfigHead} from "@/lib/pls-wish-ho-contract";
export type PublishedWishItem=Readonly<{itemId:string;revision:number;name:string;status:"PUBLISHED";itemType:"WEARABLE"|"ACCESSORY"}>;
export type BannerEdit={base:Readonly<{recordId:string;pointerVersion:number;draftVersion:number;publishedId:string|null}>;name:string;value:Omit<BannerValue,"pool">&{pool:BannerPoolItem[]}};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function bannerEdit(h:WishConfigHead<BannerValue>):BannerEdit{
 const r=h.pendingDraft??h.published;if(!r||h.staleDraft)throw Error("Tải lại bản nháp Banner.");
 return {base:Object.freeze({recordId:h.recordId,pointerVersion:h.pointerVersion,draftVersion:h.latestDraft?.version??0,publishedId:h.published?.id??null}),name:r.name,value:{...r.value,pool:r.value.pool.map(i=>({itemId:i.itemId,revision:i.revision,weight:i.weight,featured:i.featured}))}};
}
export function bannerEditCurrent(d:BannerEdit,h:WishConfigHead<BannerValue>){
 return !h.staleDraft&&d.base.recordId===h.recordId&&d.base.pointerVersion===h.pointerVersion&&d.base.draftVersion===(h.latestDraft?.version??0)&&d.base.publishedId===(h.published?.id??null);
}
export function publishedWishItems(raw:readonly PublishedWishItem[]):PublishedWishItem[]{
 if(raw.some(i=>!uuid.test(i.itemId)||!Number.isSafeInteger(i.revision)||i.revision<1||typeof i.name!=="string"||!i.name.trim()||i.status!=="PUBLISHED"||!["WEARABLE","ACCESSORY"].includes(i.itemType))||new Set(raw.map(i=>i.itemId)).size!==raw.length)throw Error("Danh mục Item chưa hợp lệ.");
 return [...raw];
}
export function addBannerItem(d:BannerEdit,itemId:string,options:readonly PublishedWishItem[]):BannerEdit{
 const i=publishedWishItems(options).find(x=>x.itemId===itemId);
 if(!i||d.value.pool.some(p=>p.itemId===itemId)||d.value.pool.length>=500)throw Error("Chọn một Item đã publish chưa có trong pool.");
 return {...d,value:{...d.value,pool:[...d.value.pool,{itemId:i.itemId,revision:i.revision,weight:1,featured:false}]}};
}
export function changeBannerItem(d:BannerEdit,itemId:string,change:Partial<Pick<BannerPoolItem,"weight"|"featured">>):BannerEdit{
 if(!d.value.pool.some(i=>i.itemId===itemId)||Object.keys(change).some(k=>k!=="weight"&&k!=="featured")||(change.weight!==undefined&&(!Number.isFinite(change.weight)||change.weight<=0))||(change.featured!==undefined&&typeof change.featured!=="boolean"))throw Error("Thông số Item không hợp lệ.");
 return {...d,value:{...d.value,pool:d.value.pool.map(i=>i.itemId===itemId?{...i,...change}:i)}};
}
export function removeBannerItem(d:BannerEdit,itemId:string):BannerEdit{return {...d,value:{...d.value,pool:d.value.pool.filter(i=>i.itemId!==itemId)}};}

// PINO operational dates are Vietnam time, independent of browser timezone.
export function wishLocalDate(iso:string):string{
 if(!iso||!Number.isFinite(Date.parse(iso)))return "";
 return new Date(Date.parse(iso)+7*3600000).toISOString().slice(0,23);
}
export function wishUtcDate(local:string):string{
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(local))return "";
 const n=Date.parse(local+"+07:00");if(!Number.isFinite(n))return "";
 const result=new Date(n).toISOString(),normalized=local.length===16?local+":00.000":local.length===19?local+".000":local.padEnd(23,"0");
 return wishLocalDate(result)===normalized?result:"";
}

export function bannerEditCommand(d:BannerEdit,h:WishConfigHead<BannerValue>){
 if(!bannerEditCurrent(d,h)||d.value.bannerId!==h.recordId||d.value.familyId!==h.latestDraft?.value.familyId)throw Error("Banner đã thay đổi hoặc family không hợp lệ.");
 return saveBannerDraft(d.value,d.name,h);
}
