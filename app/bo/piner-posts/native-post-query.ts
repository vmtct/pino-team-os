/** PAP-2386 / PNR-APP-HUB — canonical real Post location, never an authorization decision. */
export const nativePostId=(id:unknown):id is string=>typeof id==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id);
export type PostTab="overview"|"media"|"history";
export const nativePostTab=(tab:unknown):tab is PostTab=>tab==="overview"||tab==="media"||tab==="history";
export function parseNativePostQuery(input:URLSearchParams):{centerId:string|null;recordId:string|null;tab:PostTab|null;canonical:string}|null{
 const p=new URLSearchParams(input);
 for(const key of ["utm_source","utm_medium","utm_campaign","utm_term","utm_content"])p.delete(key);
 for(const key of p.keys())if(p.getAll(key).length!==1||!["centerId","record","tab"].includes(key))return null;
 const centerId=p.get("centerId"),recordId=p.get("record"),tab=p.get("tab");
 if(centerId!==null&&!nativePostId(centerId)||recordId!==null&&!nativePostId(recordId)||tab!==null&&(!recordId||!nativePostTab(tab)))return null;
 const canonical=new URLSearchParams();for(const key of ["centerId","record","tab"])if(p.has(key))canonical.set(key,p.get(key)!);
 return {centerId,recordId,tab:tab as PostTab|null,canonical:canonical.toString()};
}
