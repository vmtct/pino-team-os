/** PAP-1385 / PNR-TV: Exact Founder HO visibility GET/PATCH, Core-owned CAS/ACL/audit. */
import {authorizeHoShell,type HoEnv} from "./ho-auth";
import {BoShellGateError} from "./bo-shell-gate";
import {teamCredential,TeamAuthError} from "./team-auth";
import {callFounderCoreWithStaffPassword,type PinoCoreBinding} from "./founder-core";
import {HO_STAGING_HOSTNAME,normalizeHostname} from "./host-boundary";
import {InvalidTvVisibilityInput,isHoTvVisibilityRequest,hoTvVisibilityGet,hoTvVisibilityPatch} from "./ho-tv-visibility-contract";
export interface HoTvVisibilityEnv extends HoEnv { PINO_CORE?:PinoCoreBinding }
const response=(status:number,body:unknown,requestId?:string)=>Response.json(body,{
  status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff",
    ...(requestId?{"x-request-id":requestId}:{})},
});
const fail=(status:number,code:string)=>response(status,{error:{code}});
export async function handleHoTvVisibility(request:Request,env:HoTvVisibilityEnv):Promise<Response>{
  try{
    const url=new URL(request.url);
    if(env.APP_ENV!=="staging"||url.protocol!=="https:"||url.hostname!==HO_STAGING_HOSTNAME||
      url.port||url.hash||normalizeHostname(request.headers.get("host")||"")!==HO_STAGING_HOSTNAME||
      !isHoTvVisibilityRequest(url.pathname,request.method))
      return fail(404,"TV_VISIBILITY_NOT_FOUND");
    // Never forward unauthenticated/mis-scoped payloads or any caller-provided Founder identity.
    await authorizeHoShell(request.headers,env);
    const credential=await teamCredential(request,env,"BO");
    if(credential.kind!=="password")return fail(401,"TV_PASSWORD_REQUIRED");
    if(!env.PINO_CORE?.executeWithStaffPassword)return fail(503,"TV_CORE_UNAVAILABLE");
    let body:Record<string,unknown>;
    if(request.method==="GET"){
      body=hoTvVisibilityGet(url);
    }else{
      if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type")||""))
        return fail(400,"TV_INVALID_CONTENT_TYPE");
      const raw=await request.text();
      if(raw.length>8192)return fail(413,"TV_BODY_TOO_LARGE");
      let parsed:unknown;
      try{parsed=JSON.parse(raw);}catch{return fail(400,"TV_INVALID_BODY");}
      body=hoTvVisibilityPatch(url,parsed);
    }
    const core=await callFounderCoreWithStaffPassword(env.PINO_CORE,{
      method:request.method,path:url.pathname.slice("/api/ho/".length),body,
    },credential.token);
    if(!Number.isSafeInteger(core.status)||core.status<200||core.status>599||
      typeof core.requestId!=="string"||!core.requestId.trim())
      return fail(502,"TV_CORE_CONTRACT_INVALID");
    return response(core.status,core.body,core.requestId);
  }catch(error){
    if(error instanceof InvalidTvVisibilityInput)return fail(400,"TV_INVALID_VISIBILITY_INPUT");
    if(error instanceof BoShellGateError)return fail(error.status,"TV_HO_ACCESS_DENIED");
    if(error instanceof TeamAuthError)return fail(error.status,"TV_PASSWORD_REQUIRED");
    return fail(503,"TV_VISIBILITY_UNAVAILABLE");
  }
}
