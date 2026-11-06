// PAP-1526: read-only BO facade; Core reauthorizes billing.view + Center.
import {callBoAccessCoreWithCredential,type BoAccessCoreBinding} from "./bo-core";
import {teamCredential,TeamAuthError,type TeamAccessEnv} from "./team-auth";
import {billTableCenter,billTableQuery,parseBillTablePage} from "./bo-bill-table-contract";
type Env=TeamAccessEnv&{PINO_BO_CORE:BoAccessCoreBinding};
const json=(body:unknown,status:number)=>Response.json(body,{status,headers:{"cache-control":"no-store"}});
const error=(status:number,message:string)=>json({error:{message}},status);
export async function handleBoBillTableRequest(request:Request,env:Env):Promise<Response>{
 try{
  const url=new URL(request.url),center=billTableCenter(url.pathname);
  if(url.protocol!=="https:"||url.host!=="bo.staging.pinohouse.art"||url.hash||url.username||url.password||
   request.headers.has("host")&&request.headers.get("host")!==url.host||!center)return error(404,"Not found");
  if(request.method!=="GET")return error(405,"Method not allowed");
  if(request.headers.has("origin")&&request.headers.get("origin")!==url.origin||request.headers.get("sec-fetch-site")==="cross-site")return error(403,"Wrong origin");
  const query=billTableQuery(url.searchParams,center);
  if(!query)return error(400,"Exactly one matching Center and valid Bill pagination are required");
  const credential=await teamCredential(request,env,"BO");
  const params=new URLSearchParams({limit:String(query.limit)});
  if(query.after!==null)params.set("after",query.after);
  const result=await callBoAccessCoreWithCredential(env.PINO_BO_CORE,{method:"GET",path:"billing/bill-table/center/"+center+"?"+params,resource:{centerId:center}},credential);
  // Never echo arbitrary upstream errors or credentials into this read facade.
  if(result.status!==200)return error([400,401,403,404,409,429,503].includes(result.status)?result.status:502,"Không thể tải bảng Bill từ Core.");
  try{return json({data:parseBillTablePage((result.body as {data?:unknown})?.data,center,query.limit)},200);}
  catch{return error(502,"Dữ liệu bảng Bill không hợp lệ hoặc không đúng cơ sở.");}
 }catch(e){if(e instanceof TeamAuthError)return error(e.status,e.message);return error(503,"Bill service unavailable");}
}
