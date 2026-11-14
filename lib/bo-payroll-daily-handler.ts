/** PAP-1954 · BO Daily Payroll read-only facade. Core owns all money and Center authorization. */
import {callBoAccessCoreWithCredential,type BoAccessCoreBinding,type BoAccessRequest} from "./bo-core";
import {teamCredential,TeamAuthError,type TeamAccessEnv} from "./team-auth";

export interface BoPayrollDailyEnv extends TeamAccessEnv {PINO_BO_CORE:BoAccessCoreBinding}
const ROOT="workforce/payroll/daily";
const UUID="[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const UID=new RegExp("^"+UUID+"$");
const DETAIL=new RegExp("^"+ROOT+"/("+UUID+")/(\\d{4}-\\d{2}-\\d{2})$");
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const RANGE_KEYS=new Set(["centerId","startDate","endDate","staffMemberId","limit","offset"]);
type DailyReadResult=
  |{ok:true;centerId:string;forwardPath:string}
  |{ok:false;status:400|404|405;code:string;message:string};
const fail=(status:400|404|405,code:string,message:string):DailyReadResult=>
  ({ok:false,status,code,message});
export function isBoPayrollDailyPath(path:string):boolean {
 return path===ROOT||DETAIL.test(path);
}
function validDate(value:string):boolean {
 if(!DATE.test(value))return false;
 const epoch=Date.parse(value+"T00:00:00Z");
 return Number.isFinite(epoch)&&new Date(epoch).toISOString().slice(0,10)===value;
}
function countOnce(query:URLSearchParams,key:string):boolean {return query.getAll(key).length===1;}
export function parseBoPayrollDailyRead(request:Request,path:string):DailyReadResult {
 if(!isBoPayrollDailyPath(path))return fail(404,"PLATFORM_NOT_FOUND","Unknown payroll read route");
 if(request.method!=="GET")return fail(405,"PLATFORM_METHOD_NOT_ALLOWED","Daily payroll is read-only");
 const detail=DETAIL.exec(path);
 const query=new URL(request.url).searchParams;
 if([...query.keys()].some(key=>!(detail?key==="centerId":RANGE_KEYS.has(key))))
  return fail(400,"PLATFORM_INVALID_INPUT","Unsupported query key");
 const centerId=query.get("centerId");
 if(!centerId||!UID.test(centerId)||!countOnce(query,"centerId"))
  return fail(400,"PLATFORM_INVALID_INPUT","Canonical Center required exactly once");
 if(detail){
  if(!validDate(detail[2]!))return fail(400,"PLATFORM_INVALID_INPUT","Invalid work date");
  return {ok:true,centerId,forwardPath:path+"?centerId="+encodeURIComponent(centerId)};
 }
 const start=query.get("startDate"),end=query.get("endDate");
 if(!start||!end||!validDate(start)||!validDate(end)||
    !countOnce(query,"startDate")||!countOnce(query,"endDate")||end<start||
    (Date.parse(end+"T00:00:00Z")-Date.parse(start+"T00:00:00Z"))/86400000>30)
  return fail(400,"PLATFORM_INVALID_INPUT","Valid date range up to 31 inclusive days required");
 const staff=query.get("staffMemberId");
 if(staff!==null&&(!countOnce(query,"staffMemberId")||!UID.test(staff)))
  return fail(400,"PLATFORM_INVALID_INPUT","Invalid Staff scope");
 const limit=query.get("limit"),offset=query.get("offset");
 if(limit!==null&&(!countOnce(query,"limit")||!/^([1-9]\d?)$|^100$/.test(limit)))
  return fail(400,"PLATFORM_INVALID_INPUT","Invalid page limit");
 if(offset!==null&&(!countOnce(query,"offset")||!/^(0|[1-9]\d{0,6})$/.test(offset)||Number(offset)>1_000_000))
  return fail(400,"PLATFORM_INVALID_INPUT","Invalid page offset");
 const safe=new URLSearchParams({centerId,startDate:start,endDate:end});
 if(staff)safe.set("staffMemberId",staff);
 if(limit)safe.set("limit",limit);
 if(offset)safe.set("offset",offset);
 return {ok:true,centerId,forwardPath:path+"?"+safe.toString()};
}
function response(body:unknown,status:number,headers:HeadersInit={}):Response {
 return Response.json(body,{status,headers:{"cache-control":"no-store",...headers}});
}
export async function handleBoPayrollDailyRead(
 request:Request,env:BoPayrollDailyEnv,path:string,
 keyResolver?:Parameters<typeof teamCredential>[3],
):Promise<Response> {
 const input=parseBoPayrollDailyRead(request,path);
 if(!input.ok)return response({error:{code:input.code,message:input.message}},input.status);
 try {
  const credential=await teamCredential(request,env,"BO",keyResolver);
  const outbound:BoAccessRequest={method:"GET",path:input.forwardPath,
    resource:{centerId:input.centerId}};
  const result=await callBoAccessCoreWithCredential(env.PINO_BO_CORE,outbound,credential);
  return response(result.body,result.status,{"x-request-id":result.requestId});
 }catch(error){
  if(error instanceof TeamAuthError)
   return response({error:{code:"IDENTITY_AUTHENTICATION_FAILED",message:error.message}},error.status);
  console.error("BO payroll daily read facade failed",error instanceof Error?error.message:"unknown");
  return response({error:{code:"PLATFORM_INTERNAL_ERROR",message:"Daily payroll unavailable"}},503);
 }
}
