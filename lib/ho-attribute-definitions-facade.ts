/** PAP-1669 / PAP-1665 PLT-ATTR FSG2 — private Founder HO definition facade.
 * Neither the browser nor a BO Manager may reach Core FounderControlPlane directly.
 */
import { authorizeHoShell, type HoEnv } from "./ho-auth";
import { BoShellGateError } from "./bo-shell-gate";
import { HO_STAGING_HOSTNAME, normalizeHostname } from "./host-boundary";
import { teamCredential, TeamAuthError } from "./team-auth";
import { callFounderCoreWithStaffPassword, type PinoCoreBinding } from "./founder-core";
import { validateAttributeDirectoryParams } from "./pap1841-attribute-directory-query";

export interface HoAttributeEnv extends HoEnv { PINO_CORE?: PinoCoreBinding }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const keyPattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]{7,119}$/;
const pathPattern = /^\/api\/ho\/custom-attributes\/definitions(?:\/([0-9a-f-]+)(\/history)?)?$/;
const allowed = new Set(["displayName","attributeKey","entityType","valueType","scope","centerId","required","visibility","options"]);
const respond = (status:number,code:string) => Response.json({error:{code}},{
  status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}
});
/** PAP-1905 / Epic PAP-1665: strict Founder-only one-field metadata CAS payload. */
export function validHoDefinitionMetadataPatch(raw:unknown):boolean{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return false;
 const o=raw as Record<string,unknown>,keys=Object.keys(o);
 const fields=["displayName","required","visibility","options"];
 const chosen=fields.filter(k=>Object.prototype.hasOwnProperty.call(o,k));
 if(keys.length!==3||chosen.length!==1||keys.some(k=>!["selectedCenterId","expectedRevision",...fields].includes(k)))return false;
 if(typeof o.selectedCenterId!=="string"||!uuid.test(o.selectedCenterId))return false;
 if(!Number.isSafeInteger(o.expectedRevision)||(o.expectedRevision as number)<1)return false;
 switch(chosen[0]){
  case "displayName":return typeof o.displayName==="string"&&o.displayName.length>0&&o.displayName.length<=120&&
   o.displayName.trim()===o.displayName&&!/[\x00-\x1f\x7f]/.test(o.displayName);
  case "required":return typeof o.required==="boolean";
  case "visibility":return Array.isArray(o.visibility)&&o.visibility.length>0&&o.visibility.length<=3&&
   o.visibility.every(x=>typeof x==="string"&&["BO","HO","TOS"].includes(x))&&
   new Set(o.visibility).size===o.visibility.length;
  case "options":return Array.isArray(o.options)&&o.options.length>0&&o.options.length<=50&&
   o.options.every(x=>typeof x==="string"&&x.length>0&&x.length<=120&&x.trim()===x)&&
   new Set(o.options.map(x=>x.normalize("NFKC").toLowerCase())).size===o.options.length;
  default:return false;
 }
}
export async function hoAttributeDefinitions(request:Request,env:HoAttributeEnv):Promise<Response> {
  const url=new URL(request.url);
  if(env.APP_ENV!=="staging"||url.protocol!=="https:"||url.port||
    url.hostname!==HO_STAGING_HOSTNAME||normalizeHostname(request.headers.get("host")??"")!==HO_STAGING_HOSTNAME||
    url.username||url.password||url.hash)return respond(404,"PLATFORM_NOT_FOUND");
  const route=pathPattern.exec(url.pathname);
  if(!route)return respond(404,"PLATFORM_NOT_FOUND");
  const id=route[1];
  const history=route[2]==="/history";
  const method=request.method.toUpperCase();
  if(method!=="GET"&&method!=="POST"&&method!=="PATCH")return respond(405,"PLATFORM_METHOD_NOT_ALLOWED");
  if(method==="PATCH"&&(!id||history||url.search))return respond(id&&url.search?400:404,"ATTRIBUTE_PATCH_ROUTE_INVALID");
  if(method==="POST"&&(id||url.search))return respond(404,"PLATFORM_NOT_FOUND");
  if(id&&!uuid.test(id))return respond(404,"ATTRIBUTE_NOT_FOUND");
  if(method==="GET"&&!id&&!validateAttributeDirectoryParams(url.searchParams))
    return respond(400,"ATTRIBUTE_QUERY_INVALID");
  if(method==="GET"&&id&&!history&&url.search)return respond(400,"ATTRIBUTE_QUERY_INVALID");
  if(history){
    for(const key of url.searchParams.keys()){
      if(!["limit","offset"].includes(key)||url.searchParams.getAll(key).length!==1)
        return respond(400,"ATTRIBUTE_HISTORY_QUERY_INVALID");
      const raw=url.searchParams.get(key)??"";
      if(!/^\d{1,5}$/.test(raw)||Number(raw)>(key==="limit"?50:10000)||
         (key==="limit"&&Number(raw)<1))return respond(400,"ATTRIBUTE_HISTORY_QUERY_INVALID");
    }
  }
  let body:unknown;
  let replayKey:string|undefined;
  if(method==="POST"||method==="PATCH"){
    if(request.headers.get("origin")!=="https://"+HO_STAGING_HOSTNAME||
      !/^application\/json(?:;|$)/i.test(request.headers.get("content-type")??""))
      return respond(403,"HO_REQUEST_DENIED");
    if(method==="POST"){
      replayKey=request.headers.get("idempotency-key")??undefined;
      if(!replayKey||!keyPattern.test(replayKey))return respond(400,"ATTRIBUTE_IDEMPOTENCY_REQUIRED");
    }
    let raw:string;
    try{raw=await request.text();}catch{return respond(400,"ATTRIBUTE_BODY_INVALID");}
    if(new TextEncoder().encode(raw).length>12288)return respond(413,"ATTRIBUTE_BODY_TOO_LARGE");
    try{body=JSON.parse(raw) as unknown;}catch{return respond(400,"ATTRIBUTE_BODY_INVALID");}
    if(method==="PATCH"?!validHoDefinitionMetadataPatch(body):
      (!body||typeof body!=="object"||Array.isArray(body)||
      Object.keys(body).some(k=>!allowed.has(k))))
      return respond(400,"ATTRIBUTE_BODY_INVALID");
  }
  try{
    const actor=await authorizeHoShell(request.headers,env);
    if(!actor.userId)return respond(403,"HO_FOUNDER_REQUIRED");
    const credential=await teamCredential(request,env,"BO");
    if(credential.kind!=="password")return respond(401,"IDENTITY_UNAUTHORIZED");
    if(!env.PINO_CORE?.executeWithStaffPassword)return respond(503,"ATTRIBUTE_CORE_UNAVAILABLE");
    const corePath=id?"custom-attributes/definitions/"+id+(history?"/history"+url.search:""):
      "custom-attributes/definitions"+(method==="GET"?url.search:"");
    const core=await callFounderCoreWithStaffPassword(env.PINO_CORE,{
      method,path:corePath,...(body===undefined?{}:{body}),
      ...(replayKey?{idempotencyKey:replayKey}:{})
    },credential.token);
    if(core.status!==200&&core.status!==201)
      return Response.json(core.body,{status:core.status,
        headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
    if(!core.body||typeof core.body!=="object"||Array.isArray(core.body)||
      !("data" in core.body))return respond(502,"ATTRIBUTE_CORE_INVALID_RESPONSE");
    return Response.json(core.body,{status:core.status,headers:{
      "cache-control":"no-store","x-content-type-options":"nosniff",
      ...(core.requestId?{"x-request-id":core.requestId}:{})
    }});
  }catch(error){
    if(error instanceof BoShellGateError)return respond(error.status,"HO_ACCESS_DENIED");
    if(error instanceof TeamAuthError)return respond(error.status,"IDENTITY_UNAUTHORIZED");
    return respond(503,"ATTRIBUTE_CORE_UNAVAILABLE");
  }
}
