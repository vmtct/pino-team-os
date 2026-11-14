/** PAP-767 / PAP-759: exact staging-only admission contract.
 * Shared host-boundary keeper must consume this before enabling the feature.
 * Return null outside the namespace so existing routes retain their policies.
 */
const uuid="[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const boPage=new RegExp("^/bo/opening-evidence/(?:CLASS|RECEPTION)/"+uuid+"$");
const boDetail=new RegExp("^/api/bo/opening-evidence/(?:CLASS|RECEPTION)/"+uuid+"$");
const boReview=new RegExp("^/api/bo/opening-evidence/(?:CLASS|RECEPTION)/"+uuid+"/review$");
const boPhoto=new RegExp("^/api/bo/opening-evidence/(?:CLASS|RECEPTION)/"+uuid+"/photo/"+uuid+"$");
const inside=(path:string,root:string)=>path===root||path.startsWith(root+"/");
const boRoots=["/bo/opening-evidence","/api/bo/opening-evidence"];
const tosRoots=["/api/workforce/class-opening","/api/workforce/reception/ready"];
export function openingEvidenceHostDecision(host:string,path:string,method:string):"next"|"not_found"|null{
 const hostname=host.toLowerCase().split(":")[0],verb=method.toUpperCase();
 if(boRoots.some(root=>inside(path,root))){
  if(hostname!=="bo.staging.pinohouse.art")return "not_found";
  if(path==="/bo/opening-evidence"||boPage.test(path))return verb==="GET"||verb==="HEAD"?"next":"not_found";
  if(path==="/api/bo/opening-evidence"||boDetail.test(path)||boPhoto.test(path))return verb==="GET"?"next":"not_found";
  return boReview.test(path)&&verb==="POST"?"next":"not_found";
 }
 const root=tosRoots.find(root=>inside(path,root));
 if(!root)return null;
 if(hostname!=="tos.staging.pinohouse.art")return "not_found";
 if(path===root)return verb==="GET"||verb==="POST"?"next":"not_found";
 if(path===root+"/append")return verb==="POST"?"next":"not_found";
 if(path===root+"/photo")return verb==="GET"?"next":"not_found";
 return "not_found";
}
