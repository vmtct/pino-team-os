/** PAP-2030 / PNR-WISH — immutable Item preview, never current Item fallback. */
export type WishItemPreviewTarget=Readonly<{itemId:string;revision:number}>;
export type WishItemPreviewSource=(target:WishItemPreviewTarget,signal:AbortSignal)=>Promise<{metadata:unknown;media:Blob}>;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export async function verifyWishItemPreview(target:WishItemPreviewTarget,metadata:unknown,media:Blob){
 if(!uuid.test(target.itemId)||!Number.isSafeInteger(target.revision)||target.revision<1||!metadata||typeof metadata!=="object"||Array.isArray(metadata))throw Error("Item preview không hợp lệ.");
 const m=metadata as Record<string,unknown>;
 if(m.itemId!==target.itemId||m.revision!==target.revision||m.status!=="PUBLISHED"||!["WEARABLE","ACCESSORY"].includes(String(m.itemType))||typeof m.name!=="string"||!m.name.trim()||typeof m.sha256!=="string"||!/^[a-f0-9]{64}$/.test(m.sha256)||!["image/png","image/webp"].includes(String(m.mimeType))||!(media instanceof Blob)||media.type!==m.mimeType||media.size!==m.byteSize||media.size<1||media.size>20*1024*1024)throw Error("Không xác minh được phiên bản media của Item.");
 const bytes=await media.arrayBuffer(),a=new Uint8Array(bytes);
 const png=a.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>a[i]===v);
 const webp=a.length>=12&&String.fromCharCode(...a.slice(0,4))==="RIFF"&&String.fromCharCode(...a.slice(8,12))==="WEBP";
 if(m.mimeType==="image/png"?!png:!webp)throw Error("Định dạng media không hợp lệ.");
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),x=>x.toString(16).padStart(2,"0")).join("");
 if(digest!==m.sha256)throw Error("Media Item không khớp phiên bản.");
 return {name:m.name,itemId:target.itemId,revision:target.revision,itemType:String(m.itemType),media};
}
