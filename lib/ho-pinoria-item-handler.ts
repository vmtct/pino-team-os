import { authorizeHoShell, type HoEnv } from "./ho-auth";
import { HO_STAGING_HOSTNAME, normalizeHostname } from "./host-boundary";
import { teamCredentialFromHeaders } from "./team-auth";
import { BoShellGateError } from "./bo-shell-gate";

interface HoItemRequest {
  method: string;
  path: string;
  body?: unknown;
  idempotencyKey?: string;
}
interface HoItemResult { status:number; body:unknown; requestId:string; }
class InvalidHoItemPayload extends Error {}
export interface HoItemBinding {
  executeWithStaffPassword(request:HoItemRequest,token:string):Promise<HoItemResult>;
}
export interface HoItemEnv extends HoEnv { PINO_HO_ITEM_CORE?:HoItemBinding; }

export const HO_ITEM_PATH = /^\/api\/ho\/pinoria\/items(?:\/uploads|\/[0-9a-f-]{36}(?:\/(?:publish|unpublish))?)?$/;

export async function handleHoPinoriaItemRequest(request:Request,env:HoItemEnv):Promise<Response>{
  const url=new URL(request.url);
  const method=request.method.toUpperCase();
  const localPath=url.pathname.length>1?url.pathname.replace(/\/$/,""):url.pathname;
  if(env.APP_ENV!=="staging" || normalizeHostname(url.hostname)!==HO_STAGING_HOSTNAME ||
     normalizeHostname(request.headers.get("host")??"")!==HO_STAGING_HOSTNAME ||
     !HO_ITEM_PATH.test(localPath))return json(404,{error:{code:"NOT_FOUND",message:"Not found"}});
  if(!["GET","POST","PATCH"].includes(method))return json(405,{error:{code:"METHOD_NOT_ALLOWED",message:"Method not allowed"}});
  try{
    const session=await authorizeHoShell(request.headers,env);
    const required=method==="GET"?"pinoria.item.view":"pinoria.item.manage";
    if(!session.permissionKeys.includes(required))return json(403,{error:{code:"ACCESS_PERMISSION_DENIED",message:"HO Item permission required"}});
    const credential=await teamCredentialFromHeaders(request.headers,env,"BO");
    if(credential.kind!=="password")return json(401,{error:{code:"AUTH_REQUIRED",message:"Staff password session required"}});
    if(!env.PINO_HO_ITEM_CORE||typeof env.PINO_HO_ITEM_CORE.executeWithStaffPassword!=="function")
      return json(503,{error:{code:"HO_ITEM_CORE_NOT_CONFIGURED",message:"HO Item service unavailable"}});
    const length=Number(request.headers.get("content-length")??0);
    if(!Number.isFinite(length)||length>14*1024*1024)return json(413,{error:{code:"PAYLOAD_TOO_LARGE",message:"Item request is too large"}});
    const body=method==="GET"?undefined:await parseBody(request);
    const path=localPath.slice("/api/ho/".length);
    const result=await env.PINO_HO_ITEM_CORE.executeWithStaffPassword(
      {method,path,body,idempotencyKey:request.headers.get("idempotency-key")??undefined},
      credential.token);
    return json(result.status,result.body,result.requestId);
  }catch(error){
    if(error instanceof InvalidHoItemPayload)return json(400,{error:{code:"INVALID_BODY",message:"Invalid Item payload"}});
    if(error instanceof BoShellGateError)return json(error.status,{error:{code:error.code??"HO_ACCESS_DENIED",message:error.message}});
    // Fail closed. Never expose Core binding/session details to external clients.
    return json(503,{error:{code:"HO_ITEM_UNAVAILABLE",message:"HO Item request unavailable"}});
  }
}
async function parseBody(request:Request):Promise<unknown>{
  let body:unknown;
  try{body=await request.json();}catch{throw new InvalidHoItemPayload("INVALID_JSON");}
  if(!body||typeof body!=="object"||Array.isArray(body))throw new InvalidHoItemPayload("INVALID_BODY");
  const record=body as Record<string,unknown>;
  if(typeof record.bytesBase64==="string"){
    const s=record.bytesBase64;
    if(s.length>14*1024*1024||!/^[A-Za-z0-9+/]+={0,2}$/.test(s))throw new InvalidHoItemPayload("BAD_MEDIA");
    let binary:string;
    try{binary=atob(s);}catch{throw new InvalidHoItemPayload("BAD_MEDIA");}
    if(binary.length>10*1024*1024)throw new InvalidHoItemPayload("BAD_MEDIA");
    const bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    const {bytesBase64,...rest}=record;
    return {...rest,bytes:bytes.buffer};
  }
  return record;
}
function json(status:number,body:unknown,requestId?:string):Response{
  return new Response(JSON.stringify(body),{status,headers:{
    "content-type":"application/json; charset=utf-8",
    "cache-control":"no-store",
    ...(requestId?{"x-request-id":requestId}:{})
  }});
}
