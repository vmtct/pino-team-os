/** PAP-1418 / PNR-TV: staging-only, read-only BFF to Core FounderControlPlane. */
import {authorizeHoShell,type HoEnv} from "./ho-auth";
import {BoShellGateError} from "./bo-shell-gate";
import {teamCredential,TeamAuthError} from "./team-auth";
import {callFounderCoreWithStaffPassword,type PinoCoreBinding} from "./founder-core";
import {HO_STAGING_HOSTNAME,normalizeHostname} from "./host-boundary";
import {InvalidTvReadQuery,isHoTvReadRequest,parseHoTvRead} from "./ho-tv-read-contract";
export interface HoTvReadEnv extends HoEnv { PINO_CORE?:PinoCoreBinding }
const response=(status:number,body:unknown,requestId?:string)=>Response.json(body,{
  status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff",
    ...(requestId?{"x-request-id":requestId}:{})},
});
const fail=(status:number,code:string)=>response(status,{error:{code}});
export async function handleHoTvRead(request:Request,env:HoTvReadEnv):Promise<Response>{
  try{
    const url=new URL(request.url);
    if(env.APP_ENV!=="staging"||url.protocol!=="https:"||url.hostname!==HO_STAGING_HOSTNAME||
      url.port||url.hash||normalizeHostname(request.headers.get("host")||"")!==HO_STAGING_HOSTNAME||
      !isHoTvReadRequest(url.pathname,request.method))return fail(404,"TV_READ_NOT_FOUND");
    const parsed=parseHoTvRead(url);
    await authorizeHoShell(request.headers,env);
    const credential=await teamCredential(request,env,"BO");
    if(credential.kind!=="password")return fail(401,"TV_PASSWORD_REQUIRED");
    if(!env.PINO_CORE?.executeWithStaffPassword)return fail(503,"TV_CORE_UNAVAILABLE");
    const core=await callFounderCoreWithStaffPassword(env.PINO_CORE,{
      method:"GET",path:parsed.path,body:parsed.body,
    },credential.token);
    if(!Number.isSafeInteger(core.status)||core.status<200||core.status>599||
      typeof core.requestId!=="string"||!core.requestId.trim())return fail(502,"TV_CORE_CONTRACT_INVALID");
    return response(core.status,core.body,core.requestId);
  }catch(error){
    if(error instanceof InvalidTvReadQuery)return fail(400,"TV_INVALID_FILTER");
    if(error instanceof BoShellGateError)return fail(error.status,"TV_HO_ACCESS_DENIED");
    if(error instanceof TeamAuthError)return fail(error.status,"TV_PASSWORD_REQUIRED");
    return fail(503,"TV_READ_UNAVAILABLE");
  }
}
