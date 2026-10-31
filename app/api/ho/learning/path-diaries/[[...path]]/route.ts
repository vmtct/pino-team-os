/** PAP-1221 / Epic PAP-727: HO Staging-only GLOBAL Diary read BFF.
 * Core Founder authorizes learning.diary.global.view on every request.
 * BO credentials NEVER become a GLOBAL grant in this facade.
 */
import {getCloudflareContext} from "@opennextjs/cloudflare";
import {authorizeHoShell,type HoEnv} from "@/lib/ho-auth";
import {BoShellGateError} from "@/lib/bo-shell-gate";
import {teamCredential,TeamAuthError,type TeamAccessEnv} from "@/lib/team-auth";
import {callFounderCoreWithStaffPassword,type PinoCoreBinding} from "@/lib/founder-core";

export const runtime="nodejs",dynamic="force-dynamic";
export type DiaryHoEnv=HoEnv&TeamAccessEnv&{PINO_CORE:PinoCoreBinding};
type Context={params:Promise<{path?:string[]}>};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const date=/^\d{4}-\d{2}-\d{2}$/;
function bad(status:number,code:string):Response{
 return Response.json({error:{code}},{status,headers:{"cache-control":"no-store"}});
}
export async function handleHoDiaryRead(request:Request,env:DiaryHoEnv,segments:readonly string[]):Promise<Response>{
 try{
  if(request.method!=="GET"||segments.length>1||(segments.length===1&&!uuid.test(segments[0]!)))
   return bad(404,"PLATFORM_NOT_FOUND");
  const query=new URL(request.url).searchParams;
  if(segments.length>0&&[...query.keys()].length)return bad(400,"PLATFORM_INVALID_INPUT");
  if([...query.keys()].some(k=>!["centerId","localDate","limit","offset"].includes(k)||query.getAll(k).length!==1))
   return bad(400,"PLATFORM_INVALID_INPUT");
  const data:Record<string,unknown>={};
  if(query.has("centerId")){
   const centerId=query.get("centerId")!;
   if(!uuid.test(centerId))return bad(400,"PLATFORM_INVALID_INPUT");
   data.centerId=centerId;
  }
  if(query.has("localDate")){
   const value=query.get("localDate")!;
   if(!date.test(value)||!Number.isFinite(Date.parse(value+"T00:00:00Z"))||
      new Date(value+"T00:00:00Z").toISOString().slice(0,10)!==value)return bad(400,"PLATFORM_INVALID_INPUT");
   data.localDate=value;
  }
  for(const field of ["limit","offset"] as const){
   if(!query.has(field))continue;
   const value=query.get(field)!;
   if(!/^(0|[1-9][0-9]{0,4})$/.test(value))return bad(400,"PLATFORM_INVALID_INPUT");
   const number=Number(value);
   if(number>(field==="limit"?100:10000)||(field==="limit"&&number<1))return bad(400,"PLATFORM_INVALID_INPUT");
   data[field]=number;
  }
  // HO pilot cohort checks an existing authenticated Core user; it is not permission elevation.
  await authorizeHoShell(request.headers,env);
  const credential=await teamCredential(request,env,"BO");
  if(credential.kind!=="password")return bad(401,"IDENTITY_UNAUTHORIZED");
  const result=await callFounderCoreWithStaffPassword(env.PINO_CORE,{
    method:"GET",path:"/learning/path-diaries"+(segments.length?"/"+segments[0]:""),
    ...(segments.length?{}:{body:data}),
  },credential.token);
  return Response.json(result.body,{status:result.status,
    headers:{"cache-control":"no-store","x-request-id":result.requestId}});
 }catch(error){
  if(error instanceof BoShellGateError)return bad(error.status,"HO_ACCESS_DENIED");
  if(error instanceof TeamAuthError)return bad(error.status,"IDENTITY_AUTHENTICATION_FAILED");
  return bad(503,"DIARY_GLOBAL_READ_UNAVAILABLE");
 }
}
export async function GET(request:Request,context:Context):Promise<Response>{
 const {env}=await getCloudflareContext({async:true}) as unknown as {env:DiaryHoEnv};
 const {path=[]}=await context.params;
 return handleHoDiaryRead(request,env,path);
}
