/** PAP-2147 / MT-GUEST: exact staging-only, same-origin, authenticated BO facade. */
import {callBoAccessCoreWithCredential,type BoAccessCoreBinding,type BoAccessRequest} from "./bo-core";
import {teamCredential,TeamAuthError,type TeamAccessEnv} from "./team-auth";
import {BO_STAGING_HOSTNAME} from "./host-boundary";
export interface BoMyTimeGuestEnv extends TeamAccessEnv{PINO_BO_CORE:BoAccessCoreBinding;APP_ENV?:string;}
const base="identity/mytime-guests",uuid="[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}",id=new RegExp("^"+uuid+"$"),detail=new RegExp("^"+base+"/"+uuid+"$"),history=new RegExp("^"+base+"/"+uuid+"/history$");
const fields=["name","gender","phone","birthDate","email","note"];
class BadInput extends Error{}
function requireId(v:unknown):string{if(typeof v!=="string"||!id.test(v))throw new BadInput();return v;}
function json(body:unknown,status:number,requestId?:string){return Response.json(body,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff",...(requestId?{"x-request-id":requestId}:{})}});}
function failure(status:number,code:string){return json({error:{code}},status);}
async function readBody(request:Request){
 if(!(request.headers.get("content-type")??"").toLowerCase().match(/^application\/json(?:\s*;|$)/))throw new BadInput();
 const reader=request.body?.getReader();if(!reader)throw new BadInput();
 const decoder=new TextDecoder("utf-8",{fatal:true});let length=0,raw="";
 try{while(true){const next=await reader.read();if(next.done)break;length+=next.value.byteLength;if(length>16384){await reader.cancel();throw new BadInput();}raw+=decoder.decode(next.value,{stream:true});}raw+=decoder.decode();const value:unknown=JSON.parse(raw);if(!value||typeof value!=="object"||Array.isArray(value))throw new BadInput();return value as Record<string,unknown>;}catch{throw new BadInput();}finally{reader.releaseLock();}
}
export async function handleBoMyTimeGuestRequest(request:Request,env:BoMyTimeGuestEnv,path:string):Promise<Response>{
 try{
  const url=new URL(request.url),isDetail=detail.test(path),isHistory=history.test(path),method=request.method,isList=path===base;
  if(env.APP_ENV!=="staging"||url.origin!=="https://"+BO_STAGING_HOSTNAME||url.pathname!=="/api/bo/"+path||(!isDetail&&!isHistory&&!isList))return failure(404,"PLATFORM_NOT_FOUND");
  if(method!=="GET"&&!(method==="POST"&&isList)&&!(method==="PATCH"&&isDetail))return failure(405,"PLATFORM_METHOD_NOT_ALLOWED");
  const allowed=method==="GET"&&isList?["centerId","limit","beforeId"]:["centerId"];
  for(const k of url.searchParams.keys())if(!allowed.includes(k)||url.searchParams.getAll(k).length!==1)throw new BadInput();
  const centerId=requireId(url.searchParams.get("centerId")),query=new URLSearchParams({centerId});
  const limit=url.searchParams.get("limit"),before=url.searchParams.get("beforeId");
  if(limit!==null){if(!/^[1-9][0-9]{0,2}$/.test(limit)||Number(limit)>100)throw new BadInput();query.set("limit",limit);}
  if(before!==null)query.set("beforeId",requireId(before));
  const credential=await teamCredential(request,env,"BO");
  if(credential.kind==="support"||request.headers.get("cookie")?.split(";").some(v=>v.trim().startsWith("pino_support_session=")))return failure(403,"ACCESS_PERMISSION_DENIED");
  const core:BoAccessRequest={method,path:path+"?"+query.toString(),resource:{centerId}};
  if(method!=="GET"){
   if(request.headers.get("origin")!==url.origin||(request.headers.has("sec-fetch-site")&&request.headers.get("sec-fetch-site")!=="same-origin"))return failure(403,"ACCESS_PERMISSION_DENIED");
   const key=request.headers.get("idempotency-key");if(!key||!/^[A-Za-z0-9_-]{16,128}$/.test(key))throw new BadInput();
   const input=await readBody(request),allowedKeys=method==="PATCH"?[...fields,"expectedVersion"]:fields;
   if(Object.keys(input).some(k=>!allowedKeys.includes(k))||Object.keys(input).filter(k=>fields.includes(k)).some(k=>input[k]!==null&&typeof input[k]!=="string"))throw new BadInput();
   if(method==="PATCH"&&(!Number.isSafeInteger(input.expectedVersion)||Number(input.expectedVersion)<1||!Object.keys(input).some(k=>fields.includes(k))))throw new BadInput();
   core.body=input;core.idempotencyKey=key;
  }
  const result=await callBoAccessCoreWithCredential(env.PINO_BO_CORE,core,credential);
  return json(result.body,result.status,result.requestId);
 }catch(e){if(e instanceof TeamAuthError)return failure(e.status,"IDENTITY_AUTHENTICATION_FAILED");if(e instanceof BadInput)return failure(400,"PLATFORM_INVALID_INPUT");return failure(500,"PLATFORM_INTERNAL_ERROR");}
}
