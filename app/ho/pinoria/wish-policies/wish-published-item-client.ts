/** PAP-2030/PAP-2087: exact published Item choices and revision-bound preview only. */
import {validateItem} from "../wardrobe/item-client";
import {publishedWishItems,type PublishedWishItem} from "../wish-banners/wish-banner-edit";
import type {WishItemPreviewTarget} from "../wish-banners/wish-item-preview";
type Requester=(action:string,init?:RequestInit)=>Promise<unknown>;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function parsePublishedWishChoices(raw:unknown):PublishedWishItem[]{
 if(!Array.isArray(raw)||raw.some(v=>!v||typeof v!=="object"||Array.isArray(v)||![3,4,5].includes(v.rarity)||Object.hasOwn(v,"asset")))throw Error("Danh mục Item Published không hợp lệ.");
 return publishedWishItems(raw as PublishedWishItem[]);
}
/** The private HO read enforces Founder, Wish config view and Item view. The
 * contextual native renderer receives read-only proof, never a manage grant. */
export async function loadPublishedWishRecord(request:Requester,target:WishItemPreviewTarget,signal:AbortSignal){
 if(!uuid.test(target.itemId)||!Number.isSafeInteger(target.revision)||target.revision<1)throw Error("Phiên bản Item không hợp lệ.");
 const raw=await request("item-record/"+target.itemId+"/"+target.revision,{signal});signal.throwIfAborted();
 const record=validateItem(raw);
 if(record.id!==target.itemId||record.revision!==target.revision||record.status!=="PUBLISHED"||record.type==="SET"||record.pendingDraft)throw Error("Không xác minh được phiên bản Item.");
 return {record,context:{surface:"HO" as const,authorize:(permission:string)=>permission==="pinoria.item.view"}};
}
export function allocateWishBannerId(){
 const b=crypto.getRandomValues(new Uint8Array(16));let t=Date.now();
 if(!Number.isSafeInteger(t)||t<0||t>=2**48)throw Error("Invalid UUID timestamp");
 for(let i=5;i>=0;i--){b[i]=t%256;t=Math.floor(t/256);}
 b[6]=(b[6]!&15)|112;b[8]=(b[8]!&63)|128;
 const v=Array.from(b,x=>x.toString(16).padStart(2,"0")).join("");
 return v.slice(0,8)+"-"+v.slice(8,12)+"-"+v.slice(12,16)+"-"+v.slice(16,20)+"-"+v.slice(20);
}
export async function loadPublishedWishPreview(request:Requester,target:WishItemPreviewTarget,signal:AbortSignal){
 if(!uuid.test(target.itemId)||!Number.isSafeInteger(target.revision)||target.revision<1)throw Error("Phiên bản Item không hợp lệ.");
 const raw=await request("item-preview/"+target.itemId+"/"+target.revision,{signal});signal.throwIfAborted();
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error("Item preview không hợp lệ.");
 const r=raw as Record<string,unknown>,{bytesBase64,...metadata}=r;
 if(r.itemId!==target.itemId||r.revision!==target.revision||typeof bytesBase64!=="string"||bytesBase64.length>14*1024*1024||!/^[A-Za-z0-9+/]+={0,2}$/.test(bytesBase64)||!["image/png","image/webp"].includes(String(r.mimeType))||!Number.isSafeInteger(r.byteSize)||Number(r.byteSize)<1||Number(r.byteSize)>10*1024*1024)throw Error("Không xác minh được Item preview.");
 const decoded=atob(bytesBase64);if(decoded.length!==r.byteSize)throw Error("Media Item không khớp kích thước.");
 const bytes=Uint8Array.from(decoded,c=>c.charCodeAt(0));
 return {metadata,media:new Blob([bytes],{type:String(r.mimeType)})};
}
