import { callBoAccessCoreWithCredential,type BoAccessCoreBinding,type BoAccessRequest } from "./bo-core";
import { teamCredential,TeamAuthError,type TeamAccessEnv } from "./team-auth";

export interface BoPayrollReviewEnv extends TeamAccessEnv {PINO_BO_CORE:BoAccessCoreBinding}
const ROOT="workforce/payroll/extra-time/reviews";
const DETAIL=/^workforce\/payroll\/extra-time\/reviews\/[0-9a-f-]{36}$/;
const DECISION=/^workforce\/payroll\/extra-time\/reviews\/[0-9a-f-]{36}\/decision$/;
const UUID=/^[0-9a-f-]{36}$/;
export function isBoPayrollReviewPath(path:string){
  return path===ROOT||DETAIL.test(path)||DECISION.test(path);
}
export async function handleBoPayrollReviewRequest(
  request:Request,env:BoPayrollReviewEnv,path:string,
  keyResolver?:Parameters<typeof teamCredential>[3],
):Promise<Response>{
  try{
    if(!isBoPayrollReviewPath(path))return json({error:{code:"PLATFORM_NOT_FOUND"}},404);
    const url=new URL(request.url),centerId=url.searchParams.get("centerId");
    if(!centerId||!UUID.test(centerId))return json({error:{code:"PLATFORM_INVALID_INPUT",message:"Center required"}},400);
    const credential=await teamCredential(request,env,"BO",keyResolver);
    let outbound:BoAccessRequest;
    if(request.method==="GET"&&(path===ROOT||DETAIL.test(path))){
      if(path===ROOT){
        const startDate=url.searchParams.get("startDate")??"";
        const endDate=url.searchParams.get("endDate")??"";
        if(!validDate(startDate)||!validDate(endDate)||endDate<startDate)
          return json({error:{code:"PLATFORM_INVALID_INPUT",message:"Date range invalid"}},400);
        const rawLimit=url.searchParams.get("limit"),rawOffset=url.searchParams.get("offset");
        if(rawLimit!==null&&(!/^\d+$/.test(rawLimit)||Number(rawLimit)<1||Number(rawLimit)>100))
          return json({error:{code:"PLATFORM_INVALID_INPUT",message:"Limit invalid"}},400);
        if(rawOffset!==null&&(!/^\d+$/.test(rawOffset)||Number(rawOffset)>1_000_000))
          return json({error:{code:"PLATFORM_INVALID_INPUT",message:"Offset invalid"}},400);
      }
      outbound={method:"GET",path:path+"?"+url.searchParams.toString(),resource:{centerId}};
    }else if(request.method==="POST"&&DECISION.test(path)){
      const key=request.headers.get("idempotency-key")??"";
      if(!/^[A-Za-z0-9._:-]{8,160}$/.test(key))
        return json({error:{code:"PLATFORM_INVALID_INPUT",message:"Idempotency key required"}},400);
      let raw:unknown;
      try{raw=await request.json();}catch{return json({error:{code:"PLATFORM_INVALID_INPUT",message:"JSON required"}},400);}
      if(!raw||typeof raw!=="object"||Array.isArray(raw))
        return json({error:{code:"PLATFORM_INVALID_INPUT",message:"Object body required"}},400);
      const body=raw as Record<string,unknown>;
      if(body.centerId!==centerId||!["APPROVED","REJECTED"].includes(String(body.decision))||
        typeof body.reason!=="string"||body.reason.trim().length<10||body.reason.trim().length>1000)
        return json({error:{code:"PLATFORM_INVALID_INPUT",message:"Decision data invalid"}},400);
      if(body.decision==="APPROVED"&&
        (typeof body.approvedStartAt!=="string"||typeof body.approvedEndAt!=="string"))
        return json({error:{code:"PLATFORM_INVALID_INPUT",message:"Approval range required"}},400);
      if(body.decision==="REJECTED"&&(body.approvedStartAt!==undefined||body.approvedEndAt!==undefined))
        return json({error:{code:"PLATFORM_INVALID_INPUT",message:"Reject cannot approve minutes"}},400);
      outbound={method:"POST",path,resource:{centerId},body,idempotencyKey:key};
    }else{
      return json({error:{code:"PLATFORM_METHOD_NOT_ALLOWED"}},405);
    }
    const result=await callBoAccessCoreWithCredential(env.PINO_BO_CORE,outbound,credential);
    return json(result.body,result.status,{"x-request-id":result.requestId});
  }catch(error){
    if(error instanceof TeamAuthError)
      return json({error:{code:"IDENTITY_AUTHENTICATION_FAILED",message:error.message}},error.status);
    console.error("BO payroll review facade failed",error instanceof Error?error.message:"unknown");
    return json({error:{code:"PLATFORM_INTERNAL_ERROR",message:"Payroll review unavailable"}},500);
  }
}
function validDate(value:string){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+"T00:00:00Z"));}
function json(body:unknown,status:number,headers:HeadersInit={}){
  return Response.json(body,{status,headers:{"cache-control":"no-store",...headers}});
}
