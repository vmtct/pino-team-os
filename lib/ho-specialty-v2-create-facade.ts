/** PAP-1495 / Epic PAP-1491 SPEC-UNLOCK — Founder-only 3-field DRAFT Create.
 * Never accept client status, tags, level, Mission links or a staging fixture Path.
 * Canonical Path id is revalidated by Core's PAP-1493 DRAFT writer.
 */
import {authorizeHoShell,type HoEnv} from './ho-auth';
import {BoShellGateError} from './bo-shell-gate';
import {HO_STAGING_HOSTNAME,normalizeHostname} from './host-boundary';
import {teamCredential,TeamAuthError} from './team-auth';
import {callFounderCoreWithStaffPassword,type PinoCoreBinding} from './founder-core';
export interface HoSpecialtyV2CreateEnv extends HoEnv{PINO_CORE?:PinoCoreBinding}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const idempotency=/^[a-zA-Z0-9][a-zA-Z0-9_-]{7,119}$/;
type Payload={name:string;pathProgramId:string;description:string|null};
const respond=(status:number,code:string)=>Response.json({error:{code}},{status,
 headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
export function parseHoSpecialtyV2Create(raw:unknown):Payload|null{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const row=raw as Record<string,unknown>;
 if(Object.keys(row).some(key=>!['name','pathProgramId','description'].includes(key)))return null;
 if(typeof row.name!=='string'||row.name.trim().length<3||row.name.trim().length>160)return null;
 if(typeof row.pathProgramId!=='string'||!uuid.test(row.pathProgramId))return null;
 if(row.description!==undefined&&row.description!==null&&
    (typeof row.description!=='string'||row.description.length>4000))return null;
 return {name:row.name.trim(),pathProgramId:row.pathProgramId,
  description:typeof row.description==='string'?(row.description.trim()||null):null};
}
export async function handleHoSpecialtyV2Create(request:Request,env:HoSpecialtyV2CreateEnv):Promise<Response>{
 const url=new URL(request.url);
 if(env.APP_ENV!=='staging'||url.protocol!=='https:'||url.port||url.hostname!==HO_STAGING_HOSTNAME||
   normalizeHostname(request.headers.get('host')??'')!==HO_STAGING_HOSTNAME||
   url.username||url.password||url.search||url.hash||url.pathname!=='/api/ho/learning/specialties')
  return respond(404,'PLATFORM_NOT_FOUND');
 if(request.method!=='POST')return respond(405,'PLATFORM_METHOD_NOT_ALLOWED');
 if(request.headers.get('origin')!=='https://'+HO_STAGING_HOSTNAME||
    !/^application\/json(?:;|$)/i.test(request.headers.get('content-type')??''))
  return respond(403,'HO_REQUEST_DENIED');
 const key=request.headers.get('idempotency-key')??'';
 if(!idempotency.test(key))return respond(400,'SPECIALTY_V2_IDEMPOTENCY_REQUIRED');
 try{
  const text=await request.text();
  if(text.length>8000)return respond(413,'SPECIALTY_V2_BODY_TOO_LARGE');
  const command=parseHoSpecialtyV2Create(JSON.parse(text) as unknown);
  if(!command)return respond(400,'SPECIALTY_V2_INVALID_DRAFT');
  const actor=await authorizeHoShell(request.headers,env);
  if(!actor.userId||!actor.permissionKeys.includes('catalog.learning.manage'))
   return respond(403,'SPECIALTY_V2_PERMISSION_DENIED');
  const credential=await teamCredential(request,env,'BO');
  if(credential.kind!=='password')return respond(401,'IDENTITY_UNAUTHORIZED');
  if(!env.PINO_CORE||typeof env.PINO_CORE.executeWithStaffPassword!=='function')
   return respond(503,'SPECIALTY_V2_CORE_UNAVAILABLE');
  const core=await callFounderCoreWithStaffPassword(env.PINO_CORE,{method:'POST',
    path:'learning/specialties',body:command,idempotencyKey:key},credential.token);
  if(core.status!==201)return Response.json(core.body,{status:core.status,
    headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
  const body=core.body as {data?:unknown}|null;
  const data=body?.data;
  if(!data||typeof data!=='object'||Array.isArray(data))return respond(502,'SPECIALTY_V2_CORE_INVALID_RESPONSE');
  const record=data as Record<string,unknown>;
  if(typeof record.id!=='string'||!uuid.test(record.id)||record.status!=='DRAFT'||
    record.version!==1||record.name!==command.name||record.pathProgramId!==command.pathProgramId)
   return respond(502,'SPECIALTY_V2_CORE_INVALID_RESPONSE');
  return Response.json(core.body,{status:201,headers:{
   'cache-control':'no-store','x-content-type-options':'nosniff',
   ...(core.requestId?{'x-request-id':core.requestId}:{})}});
 }catch(error){
  if(error instanceof SyntaxError)return respond(400,'SPECIALTY_V2_INVALID_JSON');
  if(error instanceof BoShellGateError)return respond(error.status,'HO_ACCESS_DENIED');
  if(error instanceof TeamAuthError)return respond(error.status,'IDENTITY_UNAUTHORIZED');
  return respond(503,'SPECIALTY_V2_CORE_UNAVAILABLE');
 }
}
