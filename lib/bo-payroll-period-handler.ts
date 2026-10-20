import {callBoAccessCoreWithCredential,type BoAccessCoreBinding,type BoAccessRequest} from "./bo-core";
import {teamCredential,TeamAuthError,type TeamAccessEnv} from "./team-auth";

export interface BoPayrollPeriodEnv extends TeamAccessEnv {PINO_BO_CORE:BoAccessCoreBinding}
const UUID="[0-9a-f-]{36}";
const ROOT="workforce/payroll/periods";
const PERIOD=new RegExp("^"+ROOT+"/("+UUID+")$");
const ROLLUP=new RegExp("^"+ROOT+"/("+UUID+")/staff-rollup$");
const SETTLEMENTS=new RegExp("^"+ROOT+"/("+UUID+")/settlements$");
const PREVIEW=new RegExp("^"+ROOT+"/("+UUID+")/staff/("+UUID+")/preview$");
const FINALIZE=new RegExp("^"+ROOT+"/("+UUID+")/staff/("+UUID+")/finalize$");
const PAID=new RegExp("^workforce/payroll/settlements/("+UUID+")/paid$");
const CENTER=new RegExp("^"+UUID+"$");
const KEY=/^[A-Za-z0-9._:-]{8,160}$/;
const DATE=/^\d{4}-\d{2}-\d{2}$/;
export function isBoPayrollPeriodPath(path:string):boolean{
 return path===ROOT||PERIOD.test(path)||ROLLUP.test(path)||SETTLEMENTS.test(path)
   ||PREVIEW.test(path)||FINALIZE.test(path)||PAID.test(path);
}
function response(body:unknown,status:number,headers:HeadersInit={}):Response{
 return Response.json(body,{status,headers:{"cache-control":"no-store",...headers}});
}
export async function handleBoPayrollPeriodRequest(request:Request,env:BoPayrollPeriodEnv,path:string,
 resolver?:Parameters<typeof teamCredential>[3]):Promise<Response>{
 try{
  if(!isBoPayrollPeriodPath(path))return response({error:{code:"PLATFORM_NOT_FOUND"}},404);
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
