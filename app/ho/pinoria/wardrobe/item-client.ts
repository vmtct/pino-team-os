/** PAP-1119 S1 + PAP-1253 S2: Founder-only HO Item + SET projection. */
export type Slot="HAIR"|"FACE"|"HEADWEAR"|"OUTFIT"|"BACK"|"AURA_BACK"|"AURA_GROUND"|"PATH_MARK";
export type ItemAsset={key:string;mimeType:"image/png"|"image/webp";byteSize:number;sha256:string};
export type ItemInput={key:string;displayName:string;type:"WEARABLE"|"ACCESSORY";slot:Slot;asset:ItemAsset;positionX:number;positionY:number;scale:number;rotationDegrees:number|null;variantOfItemId?:string|null};
export type SetInput={key:string;displayName:string;type:"SET";starterEligible:boolean;memberItemIds:string[];variantOfItemId?:string|null};
type Common={id:string;key:string;displayName:string;status:"DRAFT"|"PUBLISHED"|"UNPUBLISHED";revision:number;createdAt:string;updatedAt:string;publishedAt:string|null;unpublishedAt:string|null;variantOfItemId?:string|null};
export type HoItem=Common&ItemInput&{pendingDraft?:ItemInput&{revision:number}};
/** Core GET SET members are immutable ordered, underscored R2/slot projections. */
export type SetMember={id:string;ordinal:number;item_type:"WEARABLE"|"ACCESSORY"|"SET";status:Common["status"];slot:Slot|null;asset_key:string|null;position_x:number;position_y:number;scale:number;rotation_degrees:number|null};
export type HoSetItem=Common&{type:"SET";slot:null;asset:null;positionX:number;positionY:number;scale:number;rotationDegrees:null;starterEligible?:boolean;members?:SetMember[];pendingDraft?:SetInput&{revision:number}};
export type ItemRecord=HoItem|HoSetItem;
export const slots:readonly Slot[]=["HAIR","FACE","HEADWEAR","OUTFIT","BACK","AURA_BACK","AURA_GROUND","PATH_MARK"];
export const slotNames:Record<Slot,string>={HAIR:"Tóc",FACE:"Khuôn mặt",HEADWEAR:"Phụ kiện đầu",OUTFIT:"Trang phục",BACK:"Phụ kiện lưng",AURA_BACK:"Hào quang sau",AURA_GROUND:"Hào quang nền",PATH_MARK:"Dấu ấn Path"};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export class ItemApiError extends Error{
 constructor(public readonly status:number,public readonly code:string){
  super(status===409?"Item đã được cập nhật ở phiên khác. Tải lại trước khi lưu.":status===403?"Không có quyền quản lý Item.":status===401?"Phiên đăng nhập hết hiệu lực.":status===404?"Item hoặc liên kết không tồn tại.":"Không thể xử lý Item ("+status+").");
 }
}
export function validateItem(value:unknown):ItemRecord{
 if(!value||typeof value!=="object"||Array.isArray(value))throw Error("Invalid Item projection");
 const i=value as Record<string,unknown>;
 if(!uuid.test(String(i.id))||typeof i.key!=="string"||typeof i.displayName!=="string"||
  !["WEARABLE","ACCESSORY","SET"].includes(String(i.type))||
  !["DRAFT","PUBLISHED","UNPUBLISHED"].includes(String(i.status))||
  !Number.isSafeInteger(i.revision)||Number(i.revision)<1||
  (i.variantOfItemId!==undefined&&i.variantOfItemId!==null&&!uuid.test(String(i.variantOfItemId))))throw Error("Invalid Item projection");
 if(i.type==="SET"){
  if(i.slot!==null||i.asset!==null||i.starterEligible!==undefined&&typeof i.starterEligible!=="boolean"||
    i.members!==undefined&&(!Array.isArray(i.members)||i.members.some(m=>!m||typeof m!=="object"||!uuid.test(String((m as SetMember).id)))))throw Error("Invalid SET projection");
  if(i.pendingDraft){const draft=i.pendingDraft as SetInput;if(draft.type!=="SET"||!Array.isArray(draft.memberItemIds)||draft.memberItemIds.some(k=>!uuid.test(k)))throw Error("Invalid pending SET");}
  return i as unknown as HoSetItem;
 }
 if(!slots.includes(i.slot as Slot)||!i.asset||typeof i.asset!=="object"||Array.isArray(i.asset))throw Error("Invalid Item media");
 const a=i.asset as ItemAsset;
 if(typeof a.key!=="string"||!["image/png","image/webp"].includes(a.mimeType)||
  !Number.isSafeInteger(a.byteSize)||!Number.isSafeInteger(i.revision)||
  ![i.positionX,i.positionY,i.scale].every(Number.isFinite)||
  (i.rotationDegrees!==null&&!Number.isFinite(i.rotationDegrees)))throw Error("Invalid Item projection");
 if(i.pendingDraft){
  const d=i.pendingDraft as ItemInput&{revision:number};
  if(d.revision!==i.revision||d.type!==i.type||!slots.includes(d.slot)||
   !Number.isFinite(d.positionX)||!Number.isFinite(d.positionY)||d.positionX < -1||d.positionX > 1||
   d.positionY < -1||d.positionY > 1||!Number.isFinite(d.scale)||d.scale<=0||d.scale>10||
   !d.asset||!assetUrl(d.asset,String(i.id),true)||typeof d.key!=="string"||!d.key.trim()||
   (d.rotationDegrees!==null&&!Number.isFinite(d.rotationDegrees)))throw Error("Invalid pending Item revision");
 }
 return i as unknown as HoItem;
}
export function assetUrl(asset:ItemAsset,itemId:string,draft=false):string|null{
 // HO's authenticated media boundary, never a public R2 object URL.
 if(!/^pinoria\/item\/uploads\/[a-f0-9]{64}\.(?:png|webp)$/.test(asset.key)||!uuid.test(itemId))return null;
 return "/api/ho/pinoria/items/"+itemId+(draft?"/draft-media":"/media");
}
async function api<T>(path:string,init?:RequestInit):Promise<T>{
 const response=await fetch("/api/ho/pinoria/items"+path,{cache:"no-store",credentials:"same-origin",...init});
 let body:unknown;try{body=await response.json()}catch{throw new ItemApiError(response.status,"INVALID_RESPONSE")}
 if(!response.ok){const record=body as {error?:{code?:string}};throw new ItemApiError(response.status,record.error?.code??"UNKNOWN")}
 if(!body||typeof body!=="object"||!("data" in body))throw Error("Invalid Item API response");
 return (body as {data:T}).data;
}
export async function listItems(signal?:AbortSignal):Promise<ItemRecord[]>{
 const rows=await api<unknown>("",{signal});
 if(!Array.isArray(rows))throw Error("Invalid Item list");signal?.throwIfAborted();return rows.map(validateItem);
}
export async function getItem(id:string,signal?:AbortSignal):Promise<ItemRecord>{
 if(!uuid.test(id))throw Error("Invalid Item ID");return validateItem(await api<unknown>("/"+id,{signal}));
}
export async function getWearableItem(id:string,signal?:AbortSignal):Promise<HoItem>{
 const result=await getItem(id,signal);if(result.type==="SET")throw Error("SET does not have Item Calibration");return result;
}
function requestKey(){return crypto.randomUUID()}
export async function writeItem(path:string,method:"POST"|"PATCH",body:object):Promise<ItemRecord>{
 return validateItem(await api<unknown>(path,{method,headers:{"content-type":"application/json","idempotency-key":requestKey()},body:JSON.stringify(body)}));
}
export async function writeWearableItem(path:string,method:"POST"|"PATCH",body:object):Promise<HoItem>{
 const result=await writeItem(path,method,body);if(result.type==="SET")throw Error("Unexpected SET response");return result;
}
export async function uploadItem(file:File):Promise<ItemAsset>{
 if(!["image/png","image/webp"].includes(file.type)||!file.size||file.size>10*1024*1024)throw Error("Ảnh phải là PNG hoặc WebP, tối đa 10 MB.");
 const buffer=await file.arrayBuffer();const bytes=new Uint8Array(buffer);let binary="";
 for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));
 return api<ItemAsset>("/uploads",{method:"POST",headers:{"content-type":"application/json","idempotency-key":requestKey()},body:JSON.stringify({fileName:file.name,mimeType:file.type,bytesBase64:btoa(binary)})});
}
