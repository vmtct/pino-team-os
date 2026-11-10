/** PAP-1732 / PAP-1491 SPEC-UNLOCK S1L-A — same-origin Founder-only History read.
 * Strictly redacted Core projection, no BO/TOS impersonation or raw event payload.
 */
import {authorizeHoShell,type HoEnv} from "./ho-auth";
import {BoShellGateError} from "./bo-shell-gate";
import {HO_STAGING_HOSTNAME,normalizeHostname} from "./host-boundary";
import {teamCredential,TeamAuthError} from "./team-auth";
import {callFounderCoreWithStaffPassword,type PinoCoreBinding} from "./founder-core";
import {projectSpecialtyHistoryPage} from "./ho-specialty-v2-history-client";

export interface HoSpecialtyHistoryEnv extends HoEnv {PINO_CORE?:PinoCoreBinding}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const respond=(status:number,code:string)=>Response.json({error:{code}},{status,
 headers:{"cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer"}});
export async function handleHoSpecialtyHistoryRead(request:Request,env:HoSpecialtyHistoryEnv,
 specialtyId:string):Promise<Response>{
 try{
  const u=new URL(request.url);
  if(env.APP_ENV!=="staging"||request.method!=="GET"||u.protocol!=="https:"||
    u.hostname!==HO_STAGING_HOSTNAME||u.port||u.username||u.password||u.hash||
    normalizeHostname(request.headers.get("host")??"")!==HO_STAGING_HOSTNAME||
    !uuid.test(specialtyId)||u.pathname!=="/api/ho/learning/specialties/"+specialtyId+"/history")
   return respond(404,"PLATFORM_NOT_FOUND");
  for(const key of u.searchParams.keys())
   if(!["limit","beforeVersion"].includes(key)||u.searchParams.getAll(key).length!==1)
    return respond(400,"SPECIALTY_HISTORY_QUERY_INVALID");
  const l=u.searchParams.get("limit"),b=u.searchParams.get("beforeVersion");
  if((l!==null&&(!/^[1-9][0-9]*$/.test(l)||Number(l)>50))||
     (b!==null&&(!/^[1-9][0-9]*$/.test(b)||!Number.isSafeInteger(Number(b)))))
   return respond(400,"SPECIALTY_HISTORY_QUERY_INVALID");
  const actor=await authorizeHoShell(request.headers,env);
  if(!actor.userId||!actor.permissionKeys.includes("catalog.learning.view"))
   return respond(403,"SPECIALTY_HISTORY_PERMISSION_DENIED");
  const credential=await teamCredential(request,env,"BO");
  if(credential.kind!=="password")return respond(401,"IDENTITY_UNAUTHORIZED");
  if(!env.PINO_CORE||typeof env.PINO_CORE.executeWithStaffPassword!=="function")
   return respond(503,"SPECIALTY_HISTORY_CORE_UNAVAILABLE");
  const qs=u.searchParams.toString();
  const core=await callFounderCoreWithStaffPassword(env.PINO_CORE,{
    method:"GET",path:"learning/specialties/"+specialtyId+"/history"+(qs?"?"+qs:"")
  },credential.token);
  if(core.status!==200)return Response.json(core.body,{status:core.status,
    headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
  const raw=(core.body as {data?:unknown}|null)?.data;
  try{projectSpecialtyHistoryPage(raw,{type:"learning_specialty_v2",id:specialtyId});}
  catch{return respond(502,"SPECIALTY_HISTORY_RESPONSE_UNVERIFIED");}
  return Response.json({data:raw},{status:200,headers:{
   "cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer",
   ...(core.requestId?{"x-request-id":core.requestId}:{})}});
 }catch(error){
  if(error instanceof BoShellGateError)return respond(error.status,"HO_ACCESS_DENIED");
  if(error instanceof TeamAuthError)return respond(error.status,"IDENTITY_UNAUTHORIZED");
  return respond(503,"SPECIALTY_HISTORY_CORE_UNAVAILABLE");
 }
}
