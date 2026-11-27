/** PAP-2404 exact feature-owned ingress contract; shared host gate admission remains separate. */
export const HO_EDITORIAL_API="/api/ho/learning/piner-posts/editorial";
export const EDITORIAL_CORE_PATH="ho/learning/piner-posts/editorial";
export const EDITORIAL_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export type EditorialRouteKind="queue"|"detail"|"history"|"decision";
export function editorialRoute(path:string):{kind:EditorialRouteKind;suffix:string}|null{
 if(path===HO_EDITORIAL_API)return {kind:"queue",suffix:""};
 if(!path.startsWith(HO_EDITORIAL_API+"/"))return null;
 const suffix=path.slice(HO_EDITORIAL_API.length),parts=suffix.slice(1).split("/");
 if(suffix==="/decision")return {kind:"decision",suffix};
 if(parts.length===1&&EDITORIAL_ID.test(parts[0]!))return {kind:"detail",suffix};
 if(parts.length===2&&EDITORIAL_ID.test(parts[0]!)&&parts[1]==="history")return {kind:"history",suffix};
 return null;
}
export function editorialHostDecision(hostname:string,expectedHoHostname:string,pathname:string,method:string):"next"|"not_found"|null{
 const lower=pathname.toLowerCase();
 // Fence malformed case and child paths; BO/TOS aliases never become a fallback.
 const aliases=[HO_EDITORIAL_API,HO_EDITORIAL_API.replace("/ho/","/bo/"),HO_EDITORIAL_API.replace("/ho/","/tos/")];
 if(!aliases.some(p=>lower===p||lower.startsWith(p+"/")))return null;
 const r=editorialRoute(pathname);
 return hostname===expectedHoHostname&&r&&method===(r.kind==="decision"?"POST":"GET")?"next":"not_found";
}
