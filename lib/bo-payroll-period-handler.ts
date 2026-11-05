import {callBoAccessCoreWithCredential,type BoAccessCoreBinding,type BoAccessRequest} from "./bo-core";
import {teamCredential,TeamAuthError,type TeamAccessEnv} from "./team-auth";
import {authorizeBoShell,BoShellGateError} from "./bo-shell-gate";
import {BO_STAGING_HOSTNAME,normalizeHostname} from "./host-boundary";

export interface BoPayrollPeriodEnv extends TeamAccessEnv {
 PINO_BO_CORE:BoAccessCoreBinding;
 APP_ENV?:string;
 HO_PILOT_FOUNDER_USER_IDS?:string;
}
const UUID="[0-9a-f-]{36}";
const ROOT="workforce/payroll/periods";
const PERIOD=new RegExp("^"+ROOT+"/("+UUID+")$");
const ROLLUP=new RegExp("^"+ROOT+"/("+UUID+")/staff-rollup$");
const SETTLEMENTS=new RegExp("^"+ROOT+"/("+UUID+")/settlements$");
const PREVIEW=new RegExp("^"+ROOT+"/("+UUID+")/staff/("+UUID+")/preview$");
const FINALIZE=new RegExp("^"+ROOT+"/("+UUID+")/staff/("+UUID+")/finalize$");
const PAID=new RegExp("^workforce/payroll/settlements/("+UUID+")/paid$");
// PAP-1211 — isolated, Founder-only Staging financial E2E. No Phase W UI.
const ADJUSTMENTS=new RegExp("^"+ROOT+"/("+UUID+")/staff/("+UUID+")/adjustments$");
const E2E_CENTER="0199f001-0000-7000-8000-000000000001";
const E2E_PERIOD="01a171ed-eb78-7941-b1de-dd4c020457b7";
const E2E_STAFF="01a18a28-6d8e-7db7-acbb-a18a942a5e72";
const E2E_REASON="PAP-1211 Staging-only adjustment E2E";
const CENTER=new RegExp("^"+UUID+"$");
const KEY=/^[A-Za-z0-9._:-]{8,160}$/;
const DATE=/^\d{4}-\d{2}-\d{2}$/;
export function isBoPayrollPeriodPath(path:string):boolean{
 return path===ROOT||PERIOD.test(path)||ROLLUP.test(path)||SETTLEMENTS.test(path)
   ||PREVIEW.test(path)||FINALIZE.test(path)||PAID.test(path)||ADJUSTMENTS.test(path);
}
function response(body:unknown,status:number,headers:HeadersInit={}):Response{
 return Response.json(body,{status,headers:{"cache-control":"no-store",...headers}});
}
export async function handleBoPayrollPeriodRequest(request:Request,env:BoPayrollPeriodEnv,path:string,
 resolver?:Parameters<typeof teamCredential>[3]):Promise<Response>{
 try{
  if(!isBoPayrollPeriodPath(path))return response({error:{code:"PLATFORM_NOT_FOUND"}},404);
  if(ADJUSTMENTS.test(path))return handlePAP1211Adjustment(request,env,path,resolver);
  const query=new URL(request.url).searchParams,centerId=query.get("centerId");
  if(!centerId||!CENTER.test(centerId))return response({error:{code:"PLATFORM_INVALID_INPUT",message:"Center required"}},400);
  const method=request.method.toUpperCase();
  const read=method==="GET"&&(path===ROOT||PERIOD.test(path)||ROLLUP.test(path)||SETTLEMENTS.test(path)||PREVIEW.test(path));
  const write=(method==="POST"&&(path===ROOT||FINALIZE.test(path)||PAID.test(path)))
    ||(method==="PATCH"&&PERIOD.test(path));
  if(!read&&!write)return response({error:{code:"PLATFORM_METHOD_NOT_ALLOWED"}},405);
  let body:Record<string,unknown>|undefined;
  if(write){
   let raw:unknown;
   try{raw=await request.json();}catch{return response({error:{code:"PLATFORM_INVALID_INPUT",message:"JSON required"}},400);}
   if(!raw||typeof raw!=="object"||Array.isArray(raw))return response({error:{code:"PLATFORM_INVALID_INPUT",message:"Object required"}},400);
   body=raw as Record<string,unknown>;
   if(body.centerId!==centerId)return response({error:{code:"PLATFORM_INVALID_INPUT",message:"Center mismatch"}},400);
   if((path===ROOT||PERIOD.test(path))&&
     (typeof body.name!=="string"||!body.name.trim()||
      typeof body.startDate!=="string"||!DATE.test(body.startDate)||
      typeof body.endDate!=="string"||!DATE.test(body.endDate)||body.startDate>body.endDate))
      return response({error:{code:"PLATFORM_INVALID_INPUT",message:"Invalid pay period"}},400);
   if(method==="PATCH"&&(!Number.isSafeInteger(body.expectedVersion)||Number(body.expectedVersion)<1))
      return response({error:{code:"PLATFORM_INVALID_INPUT",message:"Version required"}},400);
   if(FINALIZE.test(path)&&
      (typeof body.expectedFingerprint!=="string"||!/^[0-9a-f]{64}$/.test(body.expectedFingerprint)||
       !Array.isArray(body.acknowledgedWarnings)||body.acknowledgedWarnings.some(x=>typeof x!=="string")))
      return response({error:{code:"PLATFORM_INVALID_INPUT",message:"Finalize receipt required"}},400);
   if(PAID.test(path)&&
      (typeof body.paymentDate!=="string"||!DATE.test(body.paymentDate)||
       typeof body.paymentReference!=="string"||!body.paymentReference.trim()))
      return response({error:{code:"PLATFORM_INVALID_INPUT",message:"Payment reference required"}},400);
  }
  for(const field of ["limit","offset"]){
   const value=query.get(field);
   if(value!==null&&(!/^(0|[1-9][0-9]*)$/.test(value)||Number(value)>10000||
      (field==="limit"&&(Number(value)<1||Number(value)>(ROLLUP.test(path)?50:100)))))
    return response({error:{code:"PLATFORM_INVALID_INPUT",message:"Pagination invalid"}},400);
  }
  const key=request.headers.get("idempotency-key")??"";
  if(method==="POST"&&!KEY.test(key))
   return response({error:{code:"PLATFORM_INVALID_INPUT",message:"Idempotency key required"}},400);
  const credential=await teamCredential(request,env,"BO",resolver);
  const outbound:BoAccessRequest={method,path:path+"?"+query.toString(),resource:{centerId},
   ...(body?{body}:{}),...(method==="POST"?{idempotencyKey:key}:{})};
  const result=await callBoAccessCoreWithCredential(env.PINO_BO_CORE,outbound,credential);
  return response(result.body,result.status,{"x-request-id":result.requestId});
 }catch(error){
  if(error instanceof TeamAuthError)
   return response({error:{code:"IDENTITY_AUTHENTICATION_FAILED",message:error.message}},error.status);
  console.error("BO payroll period facade failed",error instanceof Error?error.message:"unknown");
  return response({error:{code:"PLATFORM_INTERNAL_ERROR",message:"Payroll period unavailable"}},500);
 }
}

/** PAP-1211: no generic adjustment aperture. This is a fixed synthetic Founder E2E,
 * guarded independently of existing Payroll Period read/write paths.
 * Core still authorizes the effective actor and applies atomic audit/idempotency.
 */
async function handlePAP1211Adjustment(
 request:Request,env:BoPayrollPeriodEnv,path:string,
 resolver?:Parameters<typeof teamCredential>[3],
):Promise<Response>{
 try{
  const uri=new URL(request.url);
  if(env.APP_ENV!=="staging"||
   normalizeHostname(request.headers.get("host")||uri.hostname)!==BO_STAGING_HOSTNAME)
   return response({error:{code:"PLATFORM_NOT_FOUND"}},404);
  if(request.method!=="GET"&&request.method!=="POST")
   return response({error:{code:"PLATFORM_METHOD_NOT_ALLOWED"}},405);
  // Canonical BO context is authenticated server-side, not a browser role claim.
  const actor=await authorizeBoShell(request.headers,env);
  const founderIds=(env.HO_PILOT_FOUNDER_USER_IDS||"").split(",").map(id=>id.trim()).filter(Boolean);
  if(!founderIds.includes(actor.userId))
   return response({error:{code:"BO_PAYROLL_ADJUSTMENT_DENIED"}},403);
  const match=ADJUSTMENTS.exec(path)!;
  if(match[1]!==E2E_PERIOD||match[2]!==E2E_STAFF)
   return response({error:{code:"PLATFORM_NOT_FOUND"}},404);
  const query=uri.searchParams;
  if(query.get("centerId")!==E2E_CENTER||query.getAll("centerId").length!==1||[...query.keys()].some(k=>k!=="centerId"))
   return response({error:{code:"BO_PAYROLL_ADJUSTMENT_SCOPE_DENIED"}},403);
  const credential=await teamCredential(request,env,"BO",resolver);
  const outbound:BoAccessRequest={method:request.method,path:path+"?centerId="+E2E_CENTER,
   resource:{centerId:E2E_CENTER}};
  if(request.method==="POST"){
   if(request.headers.get("origin")!=="https://"+BO_STAGING_HOSTNAME||
      !request.headers.get("content-type")?.startsWith("application/json"))
    return response({error:{code:"BO_PAYROLL_ADJUSTMENT_ORIGIN_DENIED"}},403);
   const key=request.headers.get("idempotency-key")||"";
   if(!KEY.test(key))return response({error:{code:"PLATFORM_INVALID_INPUT"}},400);
   let raw:unknown;
   try{raw=await request.json();}catch{return response({error:{code:"PLATFORM_INVALID_INPUT"}},400);}
   if(!raw||typeof raw!=="object"||Array.isArray(raw))
    return response({error:{code:"PLATFORM_INVALID_INPUT"}},400);
   const body=raw as Record<string,unknown>;
   if(Object.keys(body).sort().join(",")!=="amountMinor,centerId,reason"||
     body.centerId!==E2E_CENTER||body.amountMinor!==1200||body.reason!==E2E_REASON)
    return response({error:{code:"PLATFORM_INVALID_INPUT"}},400);
   outbound.body={centerId:E2E_CENTER,amountMinor:1200,reason:E2E_REASON};
   outbound.idempotencyKey=key;
  }
  const result=await callBoAccessCoreWithCredential(env.PINO_BO_CORE,outbound,credential);
  return response(result.body,result.status,{"x-request-id":result.requestId});
 }catch(error){
  if(error instanceof BoShellGateError)
   return response({error:{code:"BO_PAYROLL_ADJUSTMENT_AUTH_DENIED"}},error.status);
  if(error instanceof TeamAuthError)
   return response({error:{code:"IDENTITY_AUTHENTICATION_FAILED"}},error.status);
  // No Staff financial details, tokens or upstream payloads in logs.
  return response({error:{code:"BO_PAYROLL_ADJUSTMENT_UNAVAILABLE"}},503);
 }
}
