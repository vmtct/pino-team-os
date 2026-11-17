/** PAP-1970 · Strict native GET-only facade; preserve existing Core review authorization and DTO. */
import {handleBoPayrollReviewRequest,type BoPayrollReviewEnv} from "./bo-payroll-extra-review-handler";
import {validExceptionRange} from "./bo-payroll-exceptions-model";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ROOT="workforce/payroll/extra-time/reviews";
const statuses=new Set(["PENDING","WITHDRAWN","APPROVED","REJECTED"]);
export function nativeExceptionReadPath(request:Request,requestId?:string):string|null{
 if(request.method!=="GET"||(requestId!==undefined&&!UUID.test(requestId)))return null;
 const q=new URL(request.url).searchParams;
 const allowed=new Set(requestId===undefined?["centerId","startDate","endDate","status","limit","offset"]:["centerId"]);
 for(const k of q.keys())if(!allowed.has(k)||q.getAll(k).length!==1)return null;
 const center=q.get("centerId");
 if(!center||!UUID.test(center))return null;
 if(requestId!==undefined)return ROOT+"/"+requestId;
 const start=q.get("startDate"),end=q.get("endDate"),status=q.get("status");
 if(!start||!end||!validExceptionRange(start,end)||(status!==null&&!statuses.has(status)))return null;
 const limit=q.get("limit"),offset=q.get("offset");
 if(limit!==null&&(!/^[1-9]\d*$/.test(limit)||Number(limit)>100))return null;
 if(offset!==null&&(!/^(0|[1-9]\d*)$/.test(offset)||Number(offset)>1000000))return null;
 return ROOT;
}
export async function handleNativeExceptionRead(request:Request,env:BoPayrollReviewEnv,requestId?:string):Promise<Response>{
 const corePath=nativeExceptionReadPath(request,requestId);
 if(!corePath)return Response.json({error:{code:"PLATFORM_INVALID_INPUT",message:"Invalid native payroll read"}},{status:request.method==="GET"?400:405,headers:{"cache-control":"no-store"}});
 return handleBoPayrollReviewRequest(request,env,corePath);
}
