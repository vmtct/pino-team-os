/** PAP-1495 / PAP-1491 — HO GLOBAL Founder S5 DRAFT command BFF.
 * Explicit same-origin action, separately permission-gated, NEVER a generic TDD transport mutation.
 */
import {authorizeHoShell,type HoEnv} from './ho-auth';
import {BoShellGateError} from './bo-shell-gate';
import {HO_STAGING_HOSTNAME,normalizeHostname} from './host-boundary';
import {teamCredential,TeamAuthError} from './team-auth';
import {callFounderCoreWithStaffPassword,type PinoCoreBinding} from './founder-core';
import {parseSpecialtyDetail} from './ho-specialty-v2-reader';

export interface HoSpecialtyV2CommandEnv extends HoEnv {PINO_CORE?:PinoCoreBinding}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const replay=/^[a-zA-Z0-9][a-zA-Z0-9_-]{7,119}$/;
const respond=(status:number,code:string)=>Response.json({error:{code}},{status,
 headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
type Command=
 | {type:"SET_OVERVIEW";expectedVersion:number;levelCount:number;prerequisiteIds:string[];tags:string[]}
 | {type:"LINK_MISSION"|"UNLINK_MISSION";expectedVersion:number;levelId:string;missionId:string};
const keys=(x:Record<string,unknown>,expect:readonly string[])=>Object.keys(x).length===expect.length&&
 expect.every(k=>Object.hasOwn(x,k))&&Object.keys(x).every(k=>expect.includes(k));
export function parseHoSpecialtyV2Command(raw:unknown):Command|null{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const x=raw as Record<string,unknown>;
 if(!Number.isSafeInteger(x.expectedVersion)||Number(x.expectedVersion)<1)return null;
 if(x.type==="SET_OVERVIEW"){
  if(!keys(x,["type","expectedVersion","levelCount","prerequisiteIds","tags"])||
     !Number.isSafeInteger(x.levelCount)||Number(x.levelCount)<1||Number(x.levelCount)>12||
     !Array.isArray(x.prerequisiteIds)||x.prerequisiteIds.length>20||
     !x.prerequisiteIds.every(v=>typeof v==="string"&&uuid.test(v))||
     new Set(x.prerequisiteIds).size!==x.prerequisiteIds.length||
     !Array.isArray(x.tags)||x.tags.length>20||
     !x.tags.every(v=>typeof v==="string"&&v===v.trim()&&v.length>=1&&v.length<=48)||
     new Set((x.tags as string[]).map(v=>v.normalize("NFD").toLocaleLowerCase("vi"))).size!==x.tags.length)return null;
  return {type:"SET_OVERVIEW",expectedVersion:Number(x.expectedVersion),levelCount:Number(x.levelCount),
    prerequisiteIds:x.prerequisiteIds as string[],tags:x.tags as string[]};
 }
 if(x.type==="LINK_MISSION"||x.type==="UNLINK_MISSION"){
  if(!keys(x,["type","expectedVersion","levelId","missionId"])||
    typeof x.levelId!=="string"||!uuid.test(x.levelId)||
    typeof x.missionId!=="string"||!uuid.test(x.missionId))return null;
  return {type:x.type,expectedVersion:Number(x.expectedVersion),levelId:x.levelId,missionId:x.missionId};
 }
 return null;
}
export async function handleHoSpecialtyV2Command(request:Request,env:HoSpecialtyV2CommandEnv,specialtyId:string):Promise<Response>{
 const u=new URL(request.url);
 if(env.APP_ENV!=="staging"||u.protocol!=="https:"||u.port||u.hostname!==HO_STAGING_HOSTNAME||
    normalizeHostname(request.headers.get("host")??"")!==HO_STAGING_HOSTNAME||
    u.username||u.password||u.search||u.hash||
    u.pathname!=="/api/ho/learning/specialties/"+specialtyId+"/commands"||!uuid.test(specialtyId))
  return respond(404,"PLATFORM_NOT_FOUND");
 if(request.method!=="POST")return respond(405,"PLATFORM_METHOD_NOT_ALLOWED");
 if(request.headers.get("origin")!=="https://"+HO_STAGING_HOSTNAME||
    !/^application\/json(?:;|$)/i.test(request.headers.get("content-type")??""))
  return respond(403,"HO_REQUEST_DENIED");
 const key=request.headers.get("idempotency-key")??"";
 if(!replay.test(key))return respond(400,"SPECIALTY_V2_IDEMPOTENCY_REQUIRED");
 try{
  const text=await request.text();
  if(text.length>8000)return respond(413,"SPECIALTY_V2_BODY_TOO_LARGE");
  const cmd=parseHoSpecialtyV2Command(JSON.parse(text) as unknown);
  if(!cmd)return respond(400,"SPECIALTY_V2_GRAPH_INVALID");
  const actor=await authorizeHoShell(request.headers,env);
  if(!actor.userId||!actor.permissionKeys.includes("catalog.learning.manage"))
   return respond(403,"SPECIALTY_V2_PERMISSION_DENIED");
  const credential=await teamCredential(request,env,"BO");
  if(credential.kind!=="password")return respond(401,"IDENTITY_UNAUTHORIZED");
  if(!env.PINO_CORE||typeof env.PINO_CORE.executeWithStaffPassword!=="function")
   return respond(503,"SPECIALTY_V2_CORE_UNAVAILABLE");
  const route="learning/specialties/"+specialtyId;
  const core=await callFounderCoreWithStaffPassword(env.PINO_CORE,{
    method:"POST",path:route+"/commands",body:cmd,idempotencyKey:key},credential.token);
  if(core.status!==200)return Response.json(core.body,{status:core.status,
   headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
  const dto=parseSpecialtyDetail((core.body as {data?:unknown}|null)?.data);
  if(!dto||dto.id!==specialtyId||dto.status!=="DRAFT"||dto.version!==cmd.expectedVersion+1)
   return respond(502,"SPECIALTY_V2_COMMAND_RESPONSE_INVALID");
  const get=await callFounderCoreWithStaffPassword(env.PINO_CORE,{method:"GET",path:route},credential.token);
  const verified=parseSpecialtyDetail((get.body as {data?:unknown}|null)?.data);
  if(get.status!==200||!verified||verified.id!==specialtyId||verified.version!==dto.version||
     JSON.stringify(verified.levels)!==JSON.stringify(dto.levels)||
     JSON.stringify(verified.prerequisiteIds)!==JSON.stringify(dto.prerequisiteIds)||
     JSON.stringify(verified.tags)!==JSON.stringify(dto.tags)||
     verified.missionCountDistinct!==dto.missionCountDistinct)
    return respond(409,"SPECIALTY_V2_COMMAND_UNVERIFIED");
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
