/** PAP-2134: fail-closed private BO Draft ingress, before legacy fallthrough. */
const PAGE="/bo/piner-posts",BASE="/api/bo/learning/piner-posts";
const DETAIL=/^\/api\/bo\/learning\/piner-posts\/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function postDraftHostDecision(host:string,path:string,method:string):"next"|"not_found"|null {
 const lower=path.toLowerCase();
 if(!lower.startsWith(PAGE)&&!lower.startsWith(BASE))return null;
 if(host!=="bo.staging.pinohouse.art")return "not_found";
 if(path===PAGE)return method==="GET"||method==="HEAD"?"next":"not_found";
 if(path===BASE)return method==="GET"||method==="POST"?"next":"not_found";
 if(DETAIL.test(path))return method==="GET"||method==="PATCH"?"next":"not_found";
 return "not_found";
}
