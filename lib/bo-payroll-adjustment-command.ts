import {BO_STAGING_HOSTNAME,normalizeHostname} from "./host-boundary";
import {callBoAccessCoreWithCredential,type BoAccessRequest} from "./bo-core";
import {authorizeBoShell,BoShellGateError} from "./bo-shell-gate";
import {teamCredential,TeamAuthError} from "./team-auth";
import type {BoPayrollPeriodEnv} from "./bo-payroll-period-handler";

/** PAP-1956 normal product command validation, not route admission.
 * Caller must still authenticate the BO actor; Core authorizes Founder + exact Center.
 * PAP-1211 fixed synthetic route is explicitly excluded and remains unchanged.
 */
const ID="[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const CENTER=new RegExp("^"+ID+"$");
const ROUTE=new RegExp("^workforce/payroll/periods/("+ID+")/staff/("+ID+")/financial-adjustments$");
const FIXED="workforce/payroll/periods/01a171ed-eb78-7941-b1de-dd4c020457b7/staff/01a18a28-6d8e-7db7-acbb-a18a942a5e72/financial-adjustments";
const FINGERPRINT=/^[0-9a-f]{64}$/;
type Validation={ok:true;outbound:BoAccessRequest}|{ok:false;status:400|403|404|405};
const deny=(status:400|403|404|405):Validation=>({ok:false,status});

export async function validateProductAdjustmentCommand(request:Request,appEnv:string|undefined,path:string):Promise<Validation>{
 const url=new URL(request.url);
 if(appEnv!=="staging"||url.protocol!=="https:"||url.hostname!==BO_STAGING_HOSTNAME||
    normalizeHostname(request.headers.get("host")||url.hostname)!==BO_STAGING_HOSTNAME||
    path===FIXED||!ROUTE.test(path)||url.pathname!=="/api/bo/"+path)return deny(404);
 if(request.method!=="POST")return deny(405);
 if(request.headers.get("origin")!=="https://"+BO_STAGING_HOSTNAME||
    !/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type")||""))return deny(403);
 const query=url.searchParams,centerId=query.get("centerId");
 if(!centerId||!CENTER.test(centerId)||query.getAll("centerId").length!==1||
    [...query.keys()].some(k=>k!=="centerId"))return deny(400);
 let raw:unknown;
 try{raw=await request.json()}catch{return deny(400)}
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return deny(400);
 const body=raw as Record<string,unknown>;
 if(Object.keys(body).sort().join(",")!=="amountMinor,centerId,expectedFingerprint,reason"||
    body.centerId!==centerId||typeof body.amountMinor!=="number"||!Number.isSafeInteger(body.amountMinor)||
    body.amountMinor===0||Math.abs(body.amountMinor)>1_000_000_000_000||
    typeof body.reason!=="string"||body.reason.trim().length<3||body.reason.trim().length>500||
    typeof body.expectedFingerprint!=="string"||!FINGERPRINT.test(body.expectedFingerprint))return deny(400);
 const key=request.headers.get("idempotency-key")||"";
 const prefix="pay-adjust-"+body.expectedFingerprint+":";
 if(!key.startsWith(prefix)||!/^[A-Za-z0-9-]{8,64}$/.test(key.slice(prefix.length)))return deny(400);
 return {ok:true,outbound:{method:"POST",path:path.slice(0,-"/financial-adjustments".length)+"/adjustments?centerId="+centerId,resource:{centerId},idempotencyKey:key,
  body:{centerId,amountMinor:body.amountMinor,reason:body.reason.trim(),expectedFingerprint:body.expectedFingerprint}}};
}
/** Prepared normal product handler; not mounted at the host edge.
 * No role is trusted from the request. Core remains authoritative for current
 * Founder and Center permission, atomic fingerprint, immutable audit and replay.
 */
export async function handleProductAdjustmentCommand(request:Request,env:BoPayrollPeriodEnv,path:string):Promise<Response>{
 const reply=(body:unknown,status:number,headers:HeadersInit={})=>Response.json(body,{status,headers:{"cache-control":"no-store",...headers}});
 const deny=(status:number)=>reply({error:{code:"BO_PAYROLL_ADJUSTMENT_DENIED"}},status);
 try{
  const parsed=await validateProductAdjustmentCommand(request,env.APP_ENV,path);
  if(!parsed.ok)return deny(parsed.status);
  const actor=await authorizeBoShell(request.headers,env);
  if(!["payroll.period.view","payroll.settlement.view","payroll.settlement.manage"].every(p=>actor.permissionKeys.includes(p)))return deny(403);
  const credential=await teamCredential(request,env,"BO");
  const result=await callBoAccessCoreWithCredential(env.PINO_BO_CORE,parsed.outbound,credential);
  return reply(result.body,result.status,{"x-request-id":result.requestId});
 }catch(error){
  if(error instanceof BoShellGateError||error instanceof TeamAuthError)return deny(error.status);
  return reply({error:{code:"BO_PAYROLL_ADJUSTMENT_UNAVAILABLE"}},503);
 }
}
