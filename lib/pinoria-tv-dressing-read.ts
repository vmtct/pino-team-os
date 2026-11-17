/** PAP-2041: logical TV display-only projection; never invent inventory or media. */
export type DressingItem = Readonly<{itemId:string;displayName:string;image:Readonly<{mimeType:"image/png"|"image/webp";bytesBase64:string}>}>;
export type DressingScope = Readonly<{centerId:string;policyRef:string;visitId:string}>;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const record=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==="object"&&!Array.isArray(x);
const exact=(x:Record<string,unknown>,keys:string[])=>Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
export function parseDressingProjection(value:unknown,scope:DressingScope):DressingItem[]|null{
 if(!record(value)||!exact(value,["data"])||!record(value.data))return null;
 const d=value.data;
 if(!exact(d,["centerId","policyRef","visitId","items"])||d.centerId!==scope.centerId||d.policyRef!==scope.policyRef||d.visitId!==scope.visitId||!Array.isArray(d.items)||d.items.length>3)return null;
 const ids=new Set<string>();const out:DressingItem[]=[];
 for(const item of d.items){
  if(!record(item)||!exact(item,["itemId","displayName","image"])||typeof item.itemId!=="string"||!uuid.test(item.itemId)||ids.has(item.itemId)||typeof item.displayName!=="string"||!item.displayName.trim()||!record(item.image)||!exact(item.image,["mimeType","bytesBase64"]))return null;
  const im=item.image;
  if((im.mimeType!=="image/png"&&im.mimeType!=="image/webp")||typeof im.bytesBase64!=="string"||im.bytesBase64.length===0||im.bytesBase64.length>13981016||im.bytesBase64.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(im.bytesBase64))return null;
  ids.add(item.itemId);out.push({itemId:item.itemId,displayName:item.displayName,image:{mimeType:im.mimeType,bytesBase64:im.bytesBase64}});
 }
 return out;
}
export function dressingReadUrl(scope:DressingScope):string|null{
 if(!uuid.test(scope.centerId)||!uuid.test(scope.visitId)||scope.policyRef!=="tvp2-house-ambient-"+scope.centerId)return null;
 return "/api/tos-learning/pinoria/tv-policies/house-ambient/dressing?"+new URLSearchParams({centerId:scope.centerId,policyRef:scope.policyRef,visitId:scope.visitId}).toString();
}
