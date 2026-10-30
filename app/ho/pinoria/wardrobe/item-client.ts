/** PAP-1119: typed, permission-bound S1 HO Item API. No BO authoring route. */
export type Slot = "HAIR"|"FACE"|"HEADWEAR"|"OUTFIT"|"BACK"|"AURA_BACK"|"AURA_GROUND"|"PATH_MARK";
export type ItemAsset = { key:string; mimeType:"image/png"|"image/webp"; byteSize:number; sha256:string };
export type HoItem = {
 id:string; key:string; displayName:string; type:"WEARABLE"|"ACCESSORY";slot:Slot;
 status:"DRAFT"|"PUBLISHED"|"UNPUBLISHED"; asset:ItemAsset;
 positionX:number;positionY:number;scale:number;rotationDegrees:number|null;
 revision:number;createdAt:string;updatedAt:string;publishedAt:string|null;unpublishedAt:string|null;
 pendingDraft?:ItemInput&{revision:number};
};
export type ItemInput = Pick<HoItem,"key"|"displayName"|"type"|"slot"|"asset"|"positionX"|"positionY"|"scale"|"rotationDegrees">;
export const slots: readonly Slot[]=["HAIR","FACE","HEADWEAR","OUTFIT","BACK","AURA_BACK","AURA_GROUND","PATH_MARK"];
export const slotNames:Record<Slot,string>={
 HAIR:"Tóc",FACE:"Khuôn mặt",HEADWEAR:"Phụ kiện đầu",OUTFIT:"Trang phục",
 BACK:"Phụ kiện lưng",AURA_BACK:"Hào quang sau",AURA_GROUND:"Hào quang nền",PATH_MARK:"Dấu ấn Path"
};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export class ItemApiError extends Error { constructor(public readonly status:number,public readonly code:string){super(status===409?"Item đã được cập nhật ở phiên khác. Tải lại trước khi lưu.":status===403?"Không có quyền quản lý Item.":status===401?"Phiên đăng nhập hết hiệu lực.":"Không thể xử lý Item ("+status+").")} }
export function validateItem(value:unknown):HoItem {
 if(!value||typeof value!=="object"||Array.isArray(value))throw Error("Invalid Item projection");
 const item=value as HoItem;
 if(!uuid.test(item.id)||typeof item.key!=="string"||typeof item.displayName!=="string"||
  !["WEARABLE","ACCESSORY"].includes(item.type)||!slots.includes(item.slot)||
  !["DRAFT","PUBLISHED","UNPUBLISHED"].includes(item.status)||
  !item.asset||typeof item.asset.key!=="string"||!["image/png","image/webp"].includes(item.asset.mimeType)||
  !Number.isSafeInteger(item.asset.byteSize)||!Number.isSafeInteger(item.revision)||
  ![item.positionX,item.positionY,item.scale].every(Number.isFinite)||
  (item.rotationDegrees!==null&&!Number.isFinite(item.rotationDegrees)))throw Error("Invalid Item projection");
 if(item.pendingDraft){
  const d=item.pendingDraft;
  if(d.revision!==item.revision||!Number.isFinite(d.positionX)||!Number.isFinite(d.positionY)||
     d.positionX < -1||d.positionX > 1||d.positionY < -1||d.positionY > 1||
     !Number.isFinite(d.scale)||d.scale<=0||d.scale>10||
     !d.asset||!assetUrl(d.asset,item.id,true)||typeof d.key!=="string"||!d.key.trim()||
     (d.rotationDegrees!==null&&!Number.isFinite(d.rotationDegrees)))throw Error("Invalid pending Item revision");
 }
 return item;
}
export function assetUrl(asset:ItemAsset,itemId:string,draft=false):string|null {
 // Staging Item objects are NOT publicly available at assets.pinohouse.art.
 // Deliver by the HO host's authenticated GET boundary, never synthesize a public key URL.
 if(!/^pinoria\/item\/uploads\/[a-f0-9]{64}\.(?:png|webp)$/.test(asset.key)||!uuid.test(itemId))return null;
 return "/api/ho/pinoria/items/"+itemId+(draft?"/draft-media":"/media");
}
async function api<T>(path:string,init?:RequestInit):Promise<T>{
 const response=await fetch("/api/ho/pinoria/items"+path,{cache:"no-store",credentials:"same-origin",...init});
 let body:unknown;
 try{body=await response.json()}catch{throw new ItemApiError(response.status,"INVALID_RESPONSE")}
 if(!response.ok){const record=body as {error?:{code?:string}};throw new ItemApiError(response.status,record.error?.code??"UNKNOWN")}
 if(!body||typeof body!=="object"||!("data" in body))throw Error("Invalid Item API response");
 return (body as {data:T}).data;
}
export async function listItems(signal?:AbortSignal){const rows=await api<unknown>("");
 if(!Array.isArray(rows))throw Error("Invalid Item list");
 signal?.throwIfAborted();
 return rows.map(validateItem);
}
export async function getItem(id:string,signal?:AbortSignal){if(!uuid.test(id))throw Error("Invalid Item ID");const data=await api<unknown>("/"+id,{signal});return validateItem(data);}
function requestKey(){return crypto.randomUUID()}
export async function writeItem(path:string,method:"POST"|"PATCH",body:object){
 return validateItem(await api<unknown>(path,{method,headers:{"content-type":"application/json","idempotency-key":requestKey()},body:JSON.stringify(body)}));
}
export async function uploadItem(file:File):Promise<ItemAsset>{
 if(!["image/png","image/webp"].includes(file.type)||!file.size||file.size>10*1024*1024)throw Error("Ảnh phải là PNG hoặc WebP, tối đa 10 MB.");
 const buffer=await file.arrayBuffer();
 const bytes=new Uint8Array(buffer);let binary="";for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));
 return api<ItemAsset>("/uploads",{method:"POST",headers:{"content-type":"application/json","idempotency-key":requestKey()},body:JSON.stringify({fileName:file.name,mimeType:file.type,bytesBase64:btoa(binary)})});
}
