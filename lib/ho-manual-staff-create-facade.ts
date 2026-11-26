// PAP-2358 · WFM-STAFF / HO Manual Staff Creation.
// Feature-local BFF boundary; not mounted before Core route and policy admission.
import { authorizeHoShell, type HoEnv } from "./ho-auth";
import { BoShellGateError } from "./bo-shell-gate";
import { HO_STAGING_HOSTNAME, normalizeHostname } from "./host-boundary";
import { callBoAccessCoreWithStaffPassword, type BoAccessCoreBinding } from "./bo-core";
import { teamCredential, TeamAuthError } from "./team-auth";
import { projectHoStaffRow } from "../app/ho/staff/native-staff-provider";
import {staffExpectedPrincipalHeader,validExpectedStaffPrincipal} from "./ho-manual-staff-create-client";
import { parseHoManualStaffReceipt } from "./ho-manual-staff-create-receipt";
export { parseHoManualStaffReceipt } from "./ho-manual-staff-create-receipt";
import type { StaffCreateCommand } from "../app/ho/staff/manual-create-contract";

export interface HoManualStaffCreateEnv extends HoEnv { PINO_BO_CORE: BoAccessCoreBinding }
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const keyPattern=/^[a-zA-Z0-9:_-]{8,120}$/;
function object(value:unknown):Record<string,unknown>|null{
  return value!==null&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:null;
}
function exactKeys(value:Record<string,unknown>,keys:readonly string[]):boolean{
  return Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));
}
function canonical(value:unknown):value is string{return typeof value==="string"&&uuid.test(value);}
const json=(body:unknown,status:number)=>Response.json(body,{status,headers:{
  "cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer",
}});
const reject=(code:string,status:number)=>json({error:{code}},status);

export function parseHoManualStaffCommand(value:unknown):Omit<StaffCreateCommand,"login">|null{
  const b=object(value);
  const required=["name","phone","email","gender","birthDate","centerId"];
  if(!b||!exactKeys(b,Object.hasOwn(b,"existingPersonId")?[...required,"existingPersonId"]:required))return null;
  const existingPersonId=b.existingPersonId;
  if(Object.hasOwn(b,"existingPersonId")&&(typeof existingPersonId!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(existingPersonId)))return null;
  if(typeof b.name!=="string"||!b.name.trim()||b.name.trim().length>160||
     typeof b.phone!=="string"||!/^0\d{9}$/.test(b.phone)||
     typeof b.email!=="string"||b.email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)||
     !canonical(b.centerId))return null;
  const email=b.email.trim().toLowerCase();
  if(b.gender!==null&&(typeof b.gender!=="string"||!["Nam","Nữ","Khác"].includes(b.gender)))return null;
  if(b.birthDate!==null&&(typeof b.birthDate!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(b.birthDate)||
    !Number.isFinite(Date.parse(b.birthDate))||new Date(b.birthDate).toISOString().slice(0,10)!==b.birthDate))return null;

  return {name:b.name.trim(),phone:b.phone,email,gender:b.gender,birthDate:b.birthDate,centerId:b.centerId,...(typeof existingPersonId==="string"?{existingPersonId}:{})};
}
export async function handleHoManualStaffCreate(request:Request,env:HoManualStaffCreateEnv):Promise<Response>{
  try{
    const url=new URL(request.url);
    if(env.APP_ENV!=="staging"||normalizeHostname(request.headers.get("host")||url.hostname)!==HO_STAGING_HOSTNAME||
       url.pathname!=="/api/ho/staff/create"||url.search)return reject("PLATFORM_NOT_FOUND",404);
    if(request.method!=="POST")return reject("PLATFORM_METHOD_NOT_ALLOWED",405);
    if(request.headers.get("origin")!=="https://"+HO_STAGING_HOSTNAME||
       request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase()!=="application/json")return reject("HO_REQUEST_DENIED",403);
    const idempotencyKey=request.headers.get("idempotency-key")?.trim();
    if(!idempotencyKey||!keyPattern.test(idempotencyKey))return reject("PLATFORM_INVALID_INPUT",400);
    const actor=await authorizeHoShell(request.headers,env);
    if(!actor.userId)return reject("HO_ACCESS_DENIED",403);
    const expected=request.headers.get(staffExpectedPrincipalHeader);
    if(!validExpectedStaffPrincipal(expected)||expected!==actor.userId)return reject("HO_STAFF_PRINCIPAL_CHANGED",403);
    const credential=await teamCredential(request,env,"BO");
    if(credential.kind!=="password")return reject("IDENTITY_UNAUTHORIZED",401);
    const command=parseHoManualStaffCommand(await request.json().catch(()=>null));
    if(!command)return reject("PLATFORM_INVALID_INPUT",400);
    const response=await callBoAccessCoreWithStaffPassword(env.PINO_BO_CORE,{
      method:"POST",path:"ho/workforce/manual-staff/create",body:command,idempotencyKey,
    },credential.token);
    if(response.status!==201){
      const status=[400,401,403,404,409,429,503].includes(response.status)?response.status:502;
      return reject(status===409?"HO_STAFF_CREATION_CONFLICT":status===400?"PLATFORM_INVALID_INPUT":"HO_STAFF_CREATION_UNAVAILABLE",status);
    }
    const receipt=parseHoManualStaffReceipt(response.body,command.centerId);
    if(!receipt||(command.existingPersonId!==undefined&&receipt.personId!==command.existingPersonId))return reject("HO_STAFF_RECEIPT_INVALID",502);
    return json({data:receipt},201);
  }catch(error){
    if(error instanceof BoShellGateError)return reject("HO_ACCESS_DENIED",error.status);
    if(error instanceof TeamAuthError)return reject("IDENTITY_UNAUTHORIZED",error.status);
    return reject("HO_STAFF_CREATION_UNAVAILABLE",503);
  }
}

// PAP-2358: historical committed result, not a live ACL assertion.
export async function handleHoManualStaffReceipt(request:Request,env:HoManualStaffCreateEnv):Promise<Response>{
  try{
    const url=new URL(request.url);
    if(env.APP_ENV!=="staging"||normalizeHostname(request.headers.get("host")||url.hostname)!==HO_STAGING_HOSTNAME||
       url.pathname!=="/api/ho/staff/create/receipt"||url.search)return reject("PLATFORM_NOT_FOUND",404);
    if(request.method!=="POST")return reject("PLATFORM_METHOD_NOT_ALLOWED",405);
    if(request.headers.get("origin")!=="https://"+HO_STAGING_HOSTNAME||
       request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase()!=="application/json")return reject("HO_REQUEST_DENIED",403);
    const idempotencyKey=request.headers.get("idempotency-key")?.trim();
    if(!idempotencyKey||!keyPattern.test(idempotencyKey))return reject("PLATFORM_INVALID_INPUT",400);
    const actor=await authorizeHoShell(request.headers,env);
    if(!actor.userId)return reject("HO_ACCESS_DENIED",403);
    const expected=request.headers.get(staffExpectedPrincipalHeader);
    if(!validExpectedStaffPrincipal(expected)||expected!==actor.userId)return reject("HO_STAFF_PRINCIPAL_CHANGED",403);
    const credential=await teamCredential(request,env,"BO");
    if(credential.kind!=="password")return reject("IDENTITY_UNAUTHORIZED",401);
    const body=object(await request.json().catch(()=>null));
    if(!body||!exactKeys(body,["centerId"])||!canonical(body.centerId))return reject("PLATFORM_INVALID_INPUT",400);
    const response=await callBoAccessCoreWithStaffPassword(env.PINO_BO_CORE,{
      method:"POST",path:"ho/workforce/manual-staff/create/receipt",body:{centerId:body.centerId},idempotencyKey,
    },credential.token);
    if(response.status!==200)return reject("HO_STAFF_RECEIPT_UNAVAILABLE",[400,401,403,404,429,503].includes(response.status)?response.status:502);
    const root=object(response.body),data=object(root?.data);
    if(data&&exactKeys(data,["state"])&&data.state==="NOT_OBSERVED")return json({data:{state:"NOT_OBSERVED"}},200);
    if(data&&exactKeys(data,["state","receipt"])&&data.state==="COMMITTED"){
      const receipt=parseHoManualStaffReceipt({data:data.receipt},body.centerId);
      if(receipt)return json({data:{state:"COMMITTED",receipt}},200);
    }
    return reject("HO_STAFF_RECEIPT_INVALID",502);
  }catch(error){
    if(error instanceof BoShellGateError)return reject("HO_ACCESS_DENIED",error.status);
    if(error instanceof TeamAuthError)return reject("IDENTITY_UNAUTHORIZED",error.status);
    return reject("HO_STAFF_RECEIPT_UNAVAILABLE",503);
  }
}

// PAP-2358 · WFM-STAFF. Private native directory BFF, not route-admitted.
export async function handleHoManualStaffDirectory(request:Request,env:HoManualStaffCreateEnv):Promise<Response>{
  try{
    const url=new URL(request.url),base="/api/ho/staff/directory";
    const id=url.pathname===base?null:url.pathname.startsWith(base+"/")?url.pathname.slice(base.length+1):"";
    if(env.APP_ENV!=="staging"||normalizeHostname(request.headers.get("host")||url.hostname)!==HO_STAGING_HOSTNAME||
      url.search||(id!==null&&!/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)))return reject("PLATFORM_NOT_FOUND",404);
    if(request.method!=="GET")return reject("PLATFORM_METHOD_NOT_ALLOWED",405);
    if(request.body!==null||request.headers.has("idempotency-key"))return reject("PLATFORM_INVALID_INPUT",400);
    const actor=await authorizeHoShell(request.headers,env);
    if(!actor.userId)return reject("HO_ACCESS_DENIED",403);
    const expected=request.headers.get(staffExpectedPrincipalHeader);
    if(expected!==null&&(!validExpectedStaffPrincipal(expected)||expected!==actor.userId))return reject("HO_STAFF_PRINCIPAL_CHANGED",403);
    const credential=await teamCredential(request,env,"BO");
    if(credential.kind!=="password")return reject("IDENTITY_UNAUTHORIZED",401);
    const response=await callBoAccessCoreWithStaffPassword(env.PINO_BO_CORE,{
      method:"GET",path:"ho/workforce/manual-staff/directory"+(id?"/"+id:""),
    },credential.token);
    if(response.status!==200)return reject("HO_STAFF_READ_UNAVAILABLE",[400,401,403,404,429,503].includes(response.status)?response.status:502);
    const root=object(response.body);
    if(!root||!exactKeys(root,["data"]))return reject("HO_STAFF_READ_INVALID",502);
    const data=root.data;
    try{
      if(id===null){
        if(!Array.isArray(data))return reject("HO_STAFF_READ_INVALID",502);
        const ids=new Set<string>();
        for(const value of data){
          const row=projectHoStaffRow(value);
          if(ids.has(row.id))return reject("HO_STAFF_READ_INVALID",502);
          ids.add(row.id);
        }
      }else if(data!==null&&projectHoStaffRow(data,true).id!==id)return reject("HO_STAFF_READ_INVALID",502);
    }catch{return reject("HO_STAFF_READ_INVALID",502);}
    return json({data},200);
  }catch(error){
    if(error instanceof BoShellGateError)return reject("HO_ACCESS_DENIED",error.status);
    if(error instanceof TeamAuthError)return reject("IDENTITY_UNAUTHORIZED",error.status);
    return reject("HO_STAFF_READ_UNAVAILABLE",503);
  }
}
