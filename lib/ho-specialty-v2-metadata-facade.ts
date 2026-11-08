/** PAP-1495 / PAP-1491 S5: HO Founder-only same-origin metadata PUT, DRAFT-only. */
import {authorizeHoShell,type HoEnv} from "./ho-auth";
import {BoShellGateError} from "./bo-shell-gate";
import {HO_STAGING_HOSTNAME,normalizeHostname} from "./host-boundary";
import {teamCredential,TeamAuthError} from "./team-auth";
import {callFounderCoreWithStaffPassword,type PinoCoreBinding} from "./founder-core";
import {parseSpecialtyDetail} from "./ho-specialty-v2-reader";
export interface HoSpecialtyV2MetadataEnv extends HoEnv {PINO_CORE?:PinoCoreBinding}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const replay=/^[a-zA-Z0-9][a-zA-Z0-9_-]{7,119}$/;
const respond=(status:number,code:string)=>Response.json({error:{code}},{status,
 headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
export type MetadataPut={expectedVersion:number;name:string}|{expectedVersion:number;description:string|null};
export function parseSpecialtyMetadataPut(raw:unknown):MetadataPut|null{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return null;
 const x=raw as Record<string,unknown>,ks=Object.keys(x);
 if(ks.length!==2||!ks.includes("expectedVersion")||
    !Number.isSafeInteger(x.expectedVersion)||Number(x.expectedVersion)<1)return null;
 if(ks.includes("name")&&typeof x.name==="string"&&x.name.trim().length>=3&&x.name.trim().length<=160)
  return {expectedVersion:Number(x.expectedVersion),name:x.name.trim()};
 if(ks.includes("description")&&(x.description===null||
     (typeof x.description==="string"&&x.description.length<=4000)))
  return {expectedVersion:Number(x.expectedVersion),description:x.description as string|null};
 return null;
}
export async function handleHoSpecialtyV2MetadataPut(request:Request,env:HoSpecialtyV2MetadataEnv,id:string):Promise<Response>{
 const u=new URL(request.url);
 if(env.APP_ENV!=="staging"||u.protocol!=="https:"||u.port||u.hostname!==HO_STAGING_HOSTNAME||
    normalizeHostname(request.headers.get("host")??"")!==HO_STAGING_HOSTNAME||
    u.username||u.password||u.search||u.hash||
    u.pathname!=="/api/ho/learning/specialties/"+id||!uuid.test(id))return respond(404,"PLATFORM_NOT_FOUND");
 if(request.method!=="PUT")return respond(405,"PLATFORM_METHOD_NOT_ALLOWED");
 if(request.headers.get("origin")!=="https://"+HO_STAGING_HOSTNAME||
   !/^application\/json(?:;|$)/i.test(request.headers.get("content-type")??""))
   return respond(403,"HO_REQUEST_DENIED");
 const key=request.headers.get("idempotency-key")??"";
 if(!replay.test(key))return respond(400,"SPECIALTY_V2_IDEMPOTENCY_REQUIRED");
 try{
  const raw=await request.text();
  if(raw.length>8000)return respond(413,"SPECIALTY_V2_BODY_TOO_LARGE");
  const body=parseSpecialtyMetadataPut(JSON.parse(raw) as unknown);
  if(!body)return respond(400,"SPECIALTY_V2_METADATA_INVALID");
  const actor=await authorizeHoShell(request.headers,env);
  if(!actor.userId||!actor.permissionKeys.includes("catalog.learning.manage"))
   return respond(403,"SPECIALTY_V2_PERMISSION_DENIED");
  const credential=await teamCredential(request,env,"BO");
  if(credential.kind!=="password")return respond(401,"IDENTITY_UNAUTHORIZED");
  if(!env.PINO_CORE||typeof env.PINO_CORE.executeWithStaffPassword!=="function")
   return respond(503,"SPECIALTY_V2_CORE_UNAVAILABLE");
  const route="learning/specialties/"+id;
  const core=await callFounderCoreWithStaffPassword(env.PINO_CORE,{
   method:"PUT",path:route,body,idempotencyKey:key},credential.token);
  if(core.status!==200)return Response.json(core.body,{status:core.status,headers:{"cache-control":"no-store"}});
  const dto=parseSpecialtyDetail((core.body as {data?:unknown}|null)?.data);
  if(!dto||dto.id!==id||dto.status!=="DRAFT"||dto.version!==body.expectedVersion+1)
   return respond(502,"SPECIALTY_V2_METADATA_RESPONSE_INVALID");
  const get=await callFounderCoreWithStaffPassword(env.PINO_CORE,{method:"GET",path:route},credential.token);
  const verified=parseSpecialtyDetail((get.body as {data?:unknown}|null)?.data);
  if(get.status!==200||!verified||verified.id!==id||verified.status!=="DRAFT"||
    verified.version!==dto.version||verified.name!==dto.name||verified.description!==dto.description||
    ("name" in body&&verified.name!==body.name)||
    ("description" in body&&verified.description!==(body.description===null?null:body.description.trim())))
    return respond(409,"SPECIALTY_V2_METADATA_UNVERIFIED");
  return Response.json({data:verified},{status:200,headers:{
   "cache-control":"no-store","x-content-type-options":"nosniff",
   ...(core.requestId?{"x-request-id":core.requestId}:{})}});
 }catch(error){
  if(error instanceof SyntaxError)return respond(400,"SPECIALTY_V2_INVALID_JSON");
  if(error instanceof BoShellGateError)return respond(error.status,"HO_ACCESS_DENIED");
  if(error instanceof TeamAuthError)return respond(error.status,"IDENTITY_UNAUTHORIZED");
  return respond(503,"SPECIALTY_V2_CORE_UNAVAILABLE");
 }
}
