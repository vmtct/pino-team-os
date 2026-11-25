import { authorizeHoShell, type HoEnv } from "./ho-auth";
import { BoShellGateError } from "./bo-shell-gate";
import { HO_STAGING_HOSTNAME, normalizeHostname } from "./host-boundary";
import { callBoAccessCoreWithStaffPassword, type BoAccessCoreBinding } from "./bo-core";
import { teamCredential, TeamAuthError } from "./team-auth";

export interface HoRoleLifecycleEnv extends HoEnv { PINO_BO_CORE: BoAccessCoreBinding }
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const keyPattern=/^[a-zA-Z0-9:_-]{8,120}$/;
const json=(body:unknown,status:number)=>Response.json(body,{status,headers:{
  "cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer",
}});
const denied=(code:string,status:number)=>json({error:{code}},status);
function record(value:unknown):Record<string,unknown>|null {
  return value && typeof value==="object" && !Array.isArray(value) ? value as Record<string,unknown> : null;
}
function instant(value:unknown):value is string {
  return typeof value==="string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString()===value;
}
type CreateInput={roleKey:string;displayName:string;description:string|null;permissionKeys:[]};
export function parseNativeRoleCreate(value:unknown):CreateInput|null {
  const b=record(value);
  if(!b||Object.keys(b).length!==4||!["roleKey","displayName","description","permissionKeys"].every(k=>Object.hasOwn(b,k)))return null;
  if(typeof b.roleKey!=="string"||!/^[a-z][a-z0-9_-]{2,79}$/.test(b.roleKey)||b.roleKey==="founder"||
    typeof b.displayName!=="string"||!b.displayName.trim()||b.displayName.trim().length>120||
    !(b.description===null||typeof b.description==="string"&&b.description.trim().length<=500)||
    !Array.isArray(b.permissionKeys)||b.permissionKeys.length!==0)return null;
  return {roleKey:b.roleKey,displayName:b.displayName.trim(),description:typeof b.description==="string"?b.description.trim()||null:null,permissionKeys:[]};
}
export function parseNativeRoleArchive(value:unknown):{expectedUpdatedAt:string}|null {
  const b=record(value);
  return b&&Object.keys(b).length===1&&Object.hasOwn(b,"expectedUpdatedAt")&&instant(b.expectedUpdatedAt)?{expectedUpdatedAt:b.expectedUpdatedAt}:null;
}
export function verifyNativeRoleLifecycleReadback(id:string,command:CreateInput|{expectedUpdatedAt:string},value:unknown):boolean {
  const r=record(value);
  if(!r||!uuid.test(id)||r.id!==id||r.roleType!=="custom"||typeof r.roleKey!=="string"||r.roleKey==="founder"||
    !instant(r.updatedAt)||r.assignmentCount!==0)return false;
  return "roleKey" in command
    ? r.status==="active"&&r.roleKey===command.roleKey&&r.displayName===command.displayName&&r.description===command.description&&
      r.permissionCount===0&&Array.isArray(r.permissionKeys)&&r.permissionKeys.length===0
    : r.status==="archived"&&Date.parse(r.updatedAt)>Date.parse(command.expectedUpdatedAt);
}
/** Native HO only. The Core transaction owns CAS, authorization and idempotency. */
export async function handleNativeRoleLifecycle(request:Request,env:HoRoleLifecycleEnv,roleId?:string):Promise<Response> {
  try {
    const url=new URL(request.url);
    const create=roleId===undefined;
    const path=create?"ho/system/roles/create":"ho/system/roles/"+roleId+"/archive";
    if(env.APP_ENV!=="staging"||url.protocol!=="https:"||url.hostname!==HO_STAGING_HOSTNAME||
      normalizeHostname(request.headers.get("host")||"")!==HO_STAGING_HOSTNAME||url.pathname!=="/api/"+path||url.search||
      (!create&&!uuid.test(roleId)))return denied("PLATFORM_NOT_FOUND",404);
    if(request.method!=="POST")return denied("PLATFORM_METHOD_NOT_ALLOWED",405);
    if(request.headers.get("origin")!=="https://"+HO_STAGING_HOSTNAME||
      request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase()!=="application/json")return denied("HO_REQUEST_DENIED",403);
    const key=request.headers.get("idempotency-key")?.trim();
    if(!key||!keyPattern.test(key))return denied("PLATFORM_INVALID_INPUT",400);
    const body:unknown=await request.json().catch(()=>null);
    const command=create?parseNativeRoleCreate(body):parseNativeRoleArchive(body);
    if(!command)return denied("PLATFORM_INVALID_INPUT",400);
    const actor=await authorizeHoShell(request.headers,env);
    if(!actor.userId||!actor.permissionKeys.includes(create?"access.role.create":"access.role.archive"))return denied("HO_ROLE_LIFECYCLE_DENIED",403);
    const credential=await teamCredential(request,env,"BO");
    if(credential.kind!=="password")return denied("IDENTITY_UNAUTHORIZED",401);
    const result=await callBoAccessCoreWithStaffPassword(env.PINO_BO_CORE,{method:"POST",path,body:command,idempotencyKey:key},credential.token);
    if(result.status!==(create?201:200)){
      return denied("HO_ROLE_LIFECYCLE_REJECTED",[400,401,403,404,409].includes(result.status)?result.status:503);
    }
    const receipt=record(record(result.body)?.data);
    const id=receipt?.id;
    if(typeof id!=="string"||!uuid.test(id)||(!create&&id!==roleId))return denied("HO_ROLE_RECEIPT_UNCERTAIN",502);
    const read=await callBoAccessCoreWithStaffPassword(env.PINO_BO_CORE,{method:"GET",path:"access/roles/"+id},credential.token);
    const persisted=record(read.body)?.data;
    if(read.status!==200||!verifyNativeRoleLifecycleReadback(id,command,persisted))return denied("HO_ROLE_RECEIPT_UNCERTAIN",502);
    return json({data:persisted},result.status);
  }catch(error){
    if(error instanceof BoShellGateError)return denied("HO_ACCESS_DENIED",error.status);
    if(error instanceof TeamAuthError)return denied("IDENTITY_UNAUTHORIZED",error.status);
    return denied("HO_ROLE_LIFECYCLE_UNAVAILABLE",503);
  }
}
