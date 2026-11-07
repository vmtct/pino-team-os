import {authorizeHoShell, type HoEnv} from "./ho-auth";
import {BoShellGateError} from "./bo-shell-gate";
import {HO_STAGING_HOSTNAME,normalizeHostname} from "./host-boundary";
import {teamCredential,TeamAuthError} from "./team-auth";
import {callFounderCoreWithStaffPassword,type PinoCoreBinding} from "./founder-core";

/** PAP-1495 / Epic PAP-1491 SPEC-UNLOCK: read-only HO Founder V2 bridge.
 * No BO Access catalog proxy, commercial V1 mapping or client-authored data.
 */
export interface HoSpecialtyV2ReadEnv extends HoEnv {PINO_CORE?:PinoCoreBinding}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const allowed=new Set(["limit","offset","status","search","pathProgramId"]);
const reply=(status:number,code:string)=>Response.json({error:{code}},{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
export function parseHoSpecialtyV2ReadRequest(request:Request,id?:string):
 {path:string}|{status:number;code:string}{
 const url=new URL(request.url);
 if(url.protocol!=="https:"||url.hostname!==HO_STAGING_HOSTNAME||url.port||
    normalizeHostname(request.headers.get("host")??"")!==HO_STAGING_HOSTNAME||
    url.username||url.password||url.hash) return {status:404,code:"PLATFORM_NOT_FOUND"};
 if(request.method!=="GET")return {status:405,code:"PLATFORM_METHOD_NOT_ALLOWED"};
 if(id!==undefined){
  if(id==='path-options'&&!url.search)return {path:'learning/specialties/path-options'};
  if(!uuid.test(id)||url.search)return {status:404,code:"PLATFORM_NOT_FOUND"};
  return {path:"learning/specialties/"+id};
 }
 for(const key of url.searchParams.keys())
  if(!allowed.has(key)||url.searchParams.getAll(key).length!==1)
   return {status:400,code:"SPECIALTY_V2_QUERY_INVALID"};
 const limit=url.searchParams.get("limit"),offset=url.searchParams.get("offset"),
       search=url.searchParams.get("search"),status=url.searchParams.get("status"),
       path=url.searchParams.get("pathProgramId");
 if(limit!==null&&(!/^[1-9][0-9]*$/.test(limit)||Number(limit)>100))return {status:400,code:"SPECIALTY_V2_PAGE_INVALID"};
 if(offset!==null&&(!/^(0|[1-9][0-9]*)$/.test(offset)||Number(offset)>10000))return {status:400,code:"SPECIALTY_V2_PAGE_INVALID"};
 if(search!==null&&search.length>100)return {status:400,code:"SPECIALTY_V2_SEARCH_INVALID"};
 if(status!==null&&!["DRAFT","ACTIVE","ARCHIVED"].includes(status))return {status:400,code:"SPECIALTY_V2_STATUS_INVALID"};
 if(path!==null&&!uuid.test(path))return {status:400,code:"SPECIALTY_V2_PATH_INVALID"};
 return {path:"learning/specialties"+url.search};
}
export async function handleHoSpecialtyV2Read(request:Request,env:HoSpecialtyV2ReadEnv,id?:string):Promise<Response>{
 const parsed=parseHoSpecialtyV2ReadRequest(request,id);
 if("status" in parsed)return reply(parsed.status,parsed.code);
 if(env.APP_ENV!=="staging")return reply(404,"PLATFORM_NOT_FOUND");
 try{
  const actor=await authorizeHoShell(request.headers,env);
  if(!actor.userId||!actor.permissionKeys.includes("catalog.learning.view"))
   return reply(403,"SPECIALTY_V2_PERMISSION_DENIED");
  const credential=await teamCredential(request,env,"BO");
  if(credential.kind!=="password")return reply(401,"IDENTITY_UNAUTHORIZED");
  if(!env.PINO_CORE||typeof env.PINO_CORE.executeWithStaffPassword!=="function")
   return reply(503,"SPECIALTY_V2_CORE_UNAVAILABLE");
  const core=await callFounderCoreWithStaffPassword(env.PINO_CORE,{method:"GET",path:parsed.path},credential.token);
  if(core.status!==200)
   return Response.json(core.body,{status:core.status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
  if(!core.body||typeof core.body!=="object"||!("data" in core.body))
   return reply(502,"SPECIALTY_V2_CORE_INVALID_RESPONSE");
  return Response.json(core.body,{status:200,headers:{"cache-control":"no-store","x-content-type-options":"nosniff",
    ...(core.requestId?{"x-request-id":core.requestId}:{})}});
 }catch(e){
  if(e instanceof BoShellGateError)return reply(e.status,"HO_ACCESS_DENIED");
  if(e instanceof TeamAuthError)return reply(e.status,"IDENTITY_UNAUTHORIZED");
  return reply(503,"SPECIALTY_V2_CORE_UNAVAILABLE");
 }
}
