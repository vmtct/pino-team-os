/** PAP-1035 / PAP-1491 — native Subscription-owned Enrollment aperture, never a generic writer. */
import {callBoAccessCoreWithCredential,type BoAccessCoreBinding,type BoAccessRequest,type BoAccessResponse} from "./bo-core";
import {teamCredential,TeamAuthError,type TeamAccessEnv} from "./team-auth";
import {BO_STAGING_HOSTNAME} from "./host-boundary";
const uuid="[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const id=new RegExp("^"+uuid+"$");
const route=new RegExp("^subscriptions/("+uuid+")/enrollment/(list|placement|capacity|attach|transfer/("+uuid+"))$");
const day=/^\d{4}-\d{2}-\d{2}$/;
const time=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const validId=(v:unknown):v is string=>typeof v==="string"&&id.test(v);
const validDay=(v:unknown):v is string=>typeof v==="string"&&day.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const validInstant=(v:unknown):v is string=>typeof v==="string"&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(v)&&Number.isFinite(Date.parse(v));
type Plan={centerId:string;subscriptionId:string;action:string;core:BoAccessRequest;transferId?:string};
type Env=TeamAccessEnv&{PINO_BO_CORE:BoAccessCoreBinding};
class Invalid extends Error {}
const invalid=():never=>{throw new Invalid("Invalid Enrollment scope or payload");};
function keys(body:Record<string,unknown>,required:string[],optional:string[]=[]){
 if(required.some(k=>!Object.hasOwn(body,k))||Object.keys(body).some(k=>!required.includes(k)&&!optional.includes(k)))invalid();
}
function flexible(body:Record<string,unknown>){
 if(("plannedEntryLocalTime" in body)!==("plannedDurationMinutes" in body))invalid();
 if("plannedEntryLocalTime" in body&&(typeof body.plannedEntryLocalTime!=="string"||!time.test(body.plannedEntryLocalTime)||
   !Number.isSafeInteger(body.plannedDurationMinutes)||Number(body.plannedDurationMinutes)<1||Number(body.plannedDurationMinutes)>1440))invalid();
}
export function isBoScopedEnrollmentPath(path:string){return route.test(path);}
export async function planBoScopedEnrollment(request:Request,path:string):Promise<Plan>{
 const matched=route.exec(path);
 if(!matched)return invalid();
 const subscriptionId=matched[1]!,action=matched[2]!,transferId=matched[3];
 const url=new URL(request.url);
 if(url.hostname!==BO_STAGING_HOSTNAME||url.protocol!=="https:"||url.pathname!=="/api/bo/"+path)return invalid();
 const q=url.searchParams,centerId=q.get("centerId");
 if(!validId(centerId)||[...q.keys()].some(k=>q.getAll(k).length!==1))return invalid();
 const resource={centerId};
 const read=action==="list"||action==="placement"||action==="capacity";
 if(request.method!==(read?"GET":"POST"))return invalid();
 const fields=Object.fromEntries(q);
 if(action==="list"){
  keys(fields,["centerId"]);
  return {centerId,subscriptionId,action,core:{method:"GET",path:"subscriptions/"+subscriptionId+"/enrollments",resource}};
 }
 if(action==="placement"){
  keys(fields,["centerId","targetLocalDate"]);if(!validDay(fields.targetLocalDate))return invalid();
  return {centerId,subscriptionId,action,core:{method:"GET",path:"subscriptions/"+subscriptionId+"/placement",resource,body:{targetLocalDate:fields.targetLocalDate}}};
 }
 if(action==="capacity"){
  keys(fields,["centerId","targetLocalDate","runningClassId"],["plannedEntryLocalTime","plannedDurationMinutes"]);
  if(!validDay(fields.targetLocalDate)||!validId(fields.runningClassId))return invalid();
  const body:Record<string,unknown>={subscriptionId,runningClassId:fields.runningClassId,targetLocalDate:fields.targetLocalDate};
  if("plannedEntryLocalTime" in fields)body.plannedEntryLocalTime=fields.plannedEntryLocalTime;
  if("plannedDurationMinutes" in fields){
   if(!/^[1-9]\d{0,3}$/.test(fields.plannedDurationMinutes!))return invalid();
   body.plannedDurationMinutes=Number(fields.plannedDurationMinutes);
  }
  flexible(body);
  return {centerId,subscriptionId,action,core:{method:"GET",path:"enrollments/capacity",resource,body}};
 }
 keys(fields,["centerId"]);
 const key=request.headers.get("idempotency-key")?.trim();
 if(!key||key.length<8||key.length>128)return invalid();
 if(!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))return invalid();
 const raw=await request.text();
 if(new TextEncoder().encode(raw).length>8192)return invalid();
 const body:unknown=JSON.parse(raw);
 if(!object(body))return invalid();
 flexible(body);
 const optional=["plannedEntryLocalTime","plannedDurationMinutes"];
 if(action==="attach"){
  keys(body,["runningClassId","effectiveFromLocalDate","commandEffectiveLocalDate","policyEffectiveAt"],optional);
  if(!validId(body.runningClassId)||!validDay(body.effectiveFromLocalDate)||body.commandEffectiveLocalDate!==body.effectiveFromLocalDate||!validInstant(body.policyEffectiveAt))return invalid();
  return {centerId,subscriptionId,action,core:{method:"POST",path:"enrollments",resource,body:{...body,subscriptionId},idempotencyKey:key}};
 }
 if(!transferId)return invalid();
 keys(body,["destinationRunningClassId","transferLocalDate","commandEffectiveLocalDate","policyEffectiveAt","reason"],optional);
 if(!validId(body.destinationRunningClassId)||!validDay(body.transferLocalDate)||body.commandEffectiveLocalDate!==body.transferLocalDate||
  !validInstant(body.policyEffectiveAt)||typeof body.reason!=="string"||!body.reason.trim()||body.reason.length>2000)return invalid();
 return {centerId,subscriptionId,action,transferId,core:{method:"POST",path:"enrollments/"+transferId+"/transfer",resource,body,idempotencyKey:key}};
}
/** Core reauthorizes the command. The read proof prevents misbinding the URL subscription to another enrollment. */
export async function executeBoScopedEnrollment(plan:Plan,execute:(request:BoAccessRequest)=>Promise<BoAccessResponse>):Promise<BoAccessResponse>{
 if(plan.transferId){
  const proof=await execute({method:"GET",path:"subscriptions/"+plan.subscriptionId+"/enrollments",resource:{centerId:plan.centerId}});
  if(proof.status!==200)return proof;
  const body=proof.body;
  if(!object(body)||!Array.isArray(body.data)||!body.data.some(row=>object(row)&&row.id===plan.transferId&&row.subscriptionId===plan.subscriptionId))
   return {status:404,body:{error:{code:"PLATFORM_NOT_FOUND",message:"Enrollment not found in selected Subscription"}},requestId:proof.requestId};
 }
 return execute(plan.core);
}
const json=(body:unknown,status:number,requestId?:string)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...(requestId?{"x-request-id":requestId}:{})}});
export async function handleBoScopedEnrollment(request:Request,env:Env,path:string){
 try{
  const plan=await planBoScopedEnrollment(request,path);
  const credential=await teamCredential(request,env,"BO");
  const result=await executeBoScopedEnrollment(plan,core=>callBoAccessCoreWithCredential(env.PINO_BO_CORE,core,credential));
  return json(result.body,result.status,result.requestId);
 }catch(error){
  if(error instanceof Invalid||error instanceof SyntaxError)return json({error:{code:"PLATFORM_INVALID_INPUT",message:"Invalid Enrollment request"}},400);
  if(error instanceof TeamAuthError)return json({error:{code:"IDENTITY_AUTHENTICATION_FAILED",message:error.message}},error.status);
  return json({error:{code:"ENROLLMENT_FACADE_UNAVAILABLE",message:"Enrollment temporarily unavailable"}},503);
 }
}
