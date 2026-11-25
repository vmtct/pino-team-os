// PAP-2358 · WFM-STAFF / HO Manual Staff Creation.
// Feature-local BFF boundary; not mounted before Core route and policy admission.
import { authorizeHoShell, type HoEnv } from "./ho-auth";
import { BoShellGateError } from "./bo-shell-gate";
import { HO_STAGING_HOSTNAME, normalizeHostname } from "./host-boundary";
import { callBoAccessCoreWithStaffPassword, type BoAccessCoreBinding } from "./bo-core";
import { teamCredential, TeamAuthError } from "./team-auth";
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

export function parseHoManualStaffCommand(value:unknown):StaffCreateCommand|null{
  const b=object(value);
  if(!b||!exactKeys(b,["name","phone","email","gender","birthDate","centerId","login"]))return null;
  if(typeof b.name!=="string"||!b.name.trim()||b.name.trim().length>160||
     typeof b.phone!=="string"||!/^0\d{9}$/.test(b.phone)||
     typeof b.email!=="string"||b.email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)||
     !canonical(b.centerId))return null;
  const email=b.email.trim().toLowerCase();
  if(b.gender!==null&&(typeof b.gender!=="string"||!["Nam","Nữ","Khác"].includes(b.gender)))return null;
  if(b.birthDate!==null&&(typeof b.birthDate!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(b.birthDate)||
    !Number.isFinite(Date.parse(b.birthDate))||new Date(b.birthDate).toISOString().slice(0,10)!==b.birthDate))return null;
  let login:StaffCreateCommand["login"]=null;
  if(b.login!==null){
    const l=object(b.login);
    if(!l||!exactKeys(l,["email","password"])||typeof l.email!=="string"||l.email.trim().toLowerCase()!==email||
      typeof l.password!=="string"||l.password.length<10||l.password.length>128)return null;
    login={email,password:l.password};
  }
  return {name:b.name.trim(),phone:b.phone,email,gender:b.gender,birthDate:b.birthDate,centerId:b.centerId,login};
}
type Receipt={staffMemberId:string;personId:string;membershipId:string;centerId:string;accessState:"NOT_PROVISIONED"}
  |{staffMemberId:string;personId:string;membershipId:string;centerId:string;accessState:"PROVISIONED";accessUserId:string;assignmentId:string};
export function parseHoManualStaffReceipt(value:unknown,centerId:string,withLogin:boolean):Receipt|null{
  const root=object(value),b=object(root?.data);
  const fields=["staffMemberId","personId","membershipId","centerId","accessState"];
  if(!b||!exactKeys(b,withLogin?[...fields,"accessUserId","assignmentId"]:fields)||
     b.centerId!==centerId||!canonical(b.staffMemberId)||!canonical(b.personId)||!canonical(b.membershipId))return null;
  const result={staffMemberId:b.staffMemberId,personId:b.personId,membershipId:b.membershipId,centerId};
  if(!withLogin&&b.accessState==="NOT_PROVISIONED")return {...result,accessState:"NOT_PROVISIONED"};
  if(withLogin&&b.accessState==="PROVISIONED"&&canonical(b.accessUserId)&&canonical(b.assignmentId))
    return {...result,accessState:"PROVISIONED",accessUserId:b.accessUserId,assignmentId:b.assignmentId};
  return null;
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
    const receipt=parseHoManualStaffReceipt(response.body,command.centerId,command.login!==null);
    if(!receipt)return reject("HO_STAFF_RECEIPT_INVALID",502);
    return json({data:receipt},201);
  }catch(error){
    if(error instanceof BoShellGateError)return reject("HO_ACCESS_DENIED",error.status);
    if(error instanceof TeamAuthError)return reject("IDENTITY_UNAUTHORIZED",error.status);
    return reject("HO_STAFF_CREATION_UNAVAILABLE",503);
  }
}
