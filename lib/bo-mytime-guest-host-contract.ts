/** PAP-2147: exact Guest private BO entry before any generic host fallback. */
const PAGE="/bo/mytime-guests",BASE="/api/bo/identity/mytime-guests";
const DETAIL=/^\/api\/bo\/identity\/mytime-guests\/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function guestHostDecision(host:string,path:string,method:string):"next"|"not_found"|null{
 const lower=path.toLowerCase();
 if(!lower.startsWith(PAGE)&&!lower.startsWith(BASE))return null;
 if(host!=="bo.staging.pinohouse.art")return "not_found";
 if(path===PAGE)return method==="GET"||method==="HEAD"?"next":"not_found";
 if(path===BASE)return method==="GET"||method==="POST"?"next":"not_found";
 if(DETAIL.test(path))return method==="GET"||method==="PATCH"?"next":"not_found";
 if(path.endsWith("/history")&&DETAIL.test(path.slice(0,-8)))return method==="GET"?"next":"not_found";
 return "not_found";
}
