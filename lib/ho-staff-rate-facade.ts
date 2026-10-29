import {authorizeHoShell,type HoEnv} from "./ho-auth";
import {BoShellGateError} from "./bo-shell-gate";
import {HO_STAGING_HOSTNAME,normalizeHostname} from "./host-boundary";
import {callFounderCoreWithStaffPassword,type PinoCoreBinding} from "./founder-core";
import {teamCredential,TeamAuthError} from "./team-auth";

export interface HoStaffRateEnv extends HoEnv {PINO_CORE:PinoCoreBinding}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const json=(body:unknown,status:number)=>Response.json(body,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
/** Pure correction validator. Auth checks still happen before parsing any submitted payload. */
export function normalizeHoRateCorrectionPayload(b:Record<string,unknown>):{amountMinor:number;expectedVersion:number;note:string}|null{
 if(Object.keys(b).some(k=>!["amountMinor","expectedVersion","note"].includes(k))||!Number.isSafeInteger(b.amountMinor)||Number(b.amountMinor)<1||!Number.isSafeInteger(b.expectedVersion)||Number(b.expectedVersion)<1||typeof b.note!=="string"||!(b.note as string).trim()||(b.note as string).length>500)return null;
 return {amountMinor:b.amountMinor as number,expectedVersion:b.expectedVersion as number,note:(b.note as string).trim()};
}
/** Only HO pilot Founder session may invoke Core FounderControlPlane. Core rechecks GLOBAL founder role. */
export async function handleHoStaffRateRequest(request:Request,env:HoStaffRateEnv,staffId:string,rateId?:string):Promise<Response>{
 try{
  const uri=new URL(request.url);
  if(env.APP_ENV!=="staging"||normalizeHostname(request.headers.get("host")||uri.hostname)!==HO_STAGING_HOSTNAME||!uuid.test(staffId)||(rateId!==undefined&&!uuid.test(rateId)))return json({error:{code:"PLATFORM_NOT_FOUND"}},404);
  const method=request.method.toUpperCase();
  if(rateId!==undefined ? method!=="PATCH" : !["GET","POST"].includes(method))return json({error:{code:"PLATFORM_METHOD_NOT_ALLOWED"}},405);
  if(method==="POST"||method==="PATCH"){
   if(request.headers.get("origin")!=="https://"+HO_STAGING_HOSTNAME||!request.headers.get("content-type")?.startsWith("application/json"))return json({error:{code:"HO_REQUEST_DENIED"}},403);
  }
  const context=await authorizeHoShell(request.headers,env);
  if(!context.userId)return json({error:{code:"HO_ACCESS_DENIED"}},403);
  const credential=await teamCredential(request,env,"BO");
  if(credential.kind!=="password")return json({error:{code:"IDENTITY_UNAUTHORIZED"}},401);
  let body:unknown=undefined;
  if(method==="POST"||method==="PATCH"){
   body=await request.json().catch(()=>null);
   if(!body||typeof body!=="object"||Array.isArray(body))return json({error:{code:"PLATFORM_INVALID_INPUT"}},400);
   const b=body as Record<string,unknown>;
   if(method==="POST"){
    if(Object.keys(b).some(k=>!["amountMinor","effectiveFrom","note"].includes(k))||!Number.isSafeInteger(b.amountMinor)||Number(b.amountMinor)<1||typeof b.effectiveFrom!=="string"||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(b.effectiveFrom)||typeof b.note!=="string"||!(b.note as string).trim()||(b.note as string).length>500)return json({error:{code:"PLATFORM_INVALID_INPUT"}},400);
    body={amountMinor:b.amountMinor,effectiveFrom:b.effectiveFrom,note:(b.note as string).trim()};
   }else{
    const normalized=normalizeHoRateCorrectionPayload(b);
    if(!normalized)return json({error:{code:"PLATFORM_INVALID_INPUT"}},400);
    body=normalized;
   }
  }
  const response=await callFounderCoreWithStaffPassword(env.PINO_CORE,{method,path:`/workforce/staff/${staffId}/compensation${rateId===undefined?"":"/"+rateId}`,body,...(method==="POST"?{idempotencyKey:request.headers.get("idempotency-key")??undefined}:{})},credential.token);
  return json(response.body,response.status);
 }catch(error){
  if(error instanceof BoShellGateError)return json({error:{code:"HO_ACCESS_DENIED"}},error.status);
  if(error instanceof TeamAuthError)return json({error:{code:"IDENTITY_UNAUTHORIZED"}},error.status);
  if(error instanceof Error&&error.message==="FOUNDER_AUTH_REQUIRED")return json({error:{code:"HO_PERMISSION_DENIED"}},403);
  // Never include Staff rate amounts, session data or Core errors in logging.
  return json({error:{code:"HO_RATE_SERVICE_UNAVAILABLE"}},503);
 }
}
