/** PAP-2134 · BO Post Draft + PAP-2228 · Piner Post: fail-closed private BO Draft ingress and Person lookup. */
const PAGE="/bo/piner-posts",BASE="/api/bo/learning/piner-posts",PEOPLE=BASE+"/people";
const DETAIL=/^\/api\/bo\/learning\/piner-posts\/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MEDIA=/^\/api\/bo\/learning\/piner-posts\/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/attachments(?:\/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/(confirm|preview|revoke))?$/;
const UUID="[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const WORKFLOW_WRITE=new RegExp("^"+BASE+"/"+UUID+"/(?:submit|diary-selection|attachments/"+UUID+"/diary-provenance)$");
const WORKFLOW_READ=new RegExp("^"+BASE+"/"+UUID+"/(?:submission-state|workflow-state|diaries(?:/"+UUID+"/photos(?:/"+UUID+")?)?)$");
export function postDraftHostDecision(host:string,path:string,method:string):"next"|"not_found"|null {
 const lower=path.toLowerCase();
 if(!lower.startsWith(PAGE)&&!lower.startsWith(BASE))return null;
 if(host!=="bo.staging.pinohouse.art")return "not_found";
 if(path===PAGE)return method==="GET"||method==="HEAD"?"next":"not_found";
 if(path===BASE)return method==="GET"||method==="POST"?"next":"not_found";
 if(path===PEOPLE)return method==="GET"?"next":"not_found";
 if(WORKFLOW_READ.test(path))return method==="GET"?"next":"not_found";
 if(WORKFLOW_WRITE.test(path))return method==="POST"?"next":"not_found";
 const media=MEDIA.exec(path);if(media){const operation=media[1];return (method==="GET"&&(!operation||operation==="preview"))||(method==="POST"&&operation!=="preview")?"next":"not_found";}
 if(DETAIL.test(path))return method==="GET"||method==="PATCH"?"next":"not_found";
 return "not_found";
}
