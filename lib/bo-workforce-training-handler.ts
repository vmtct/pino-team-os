import type { JWTVerifyGetKey } from "jose";
import { authenticateBo, BoAuthError, type VerifiedBoIdentity } from "./bo-auth";
import { stagingBoWorkforceIdentity, type BoWorkforceStagingAuthEnv } from "./bo-workforce-staging-auth";

export interface WorkforceTrainingRequest {method:string;path:string;body?:unknown;idempotencyKey?:string}
export interface WorkforceTrainingResponse {status:number;body:unknown;requestId:string}
export interface WorkforceTrainingCoreBinding {executeTraining(request:WorkforceTrainingRequest,identity:VerifiedBoIdentity):Promise<WorkforceTrainingResponse>}
export interface BoWorkforceTrainingEnv extends BoWorkforceStagingAuthEnv {
  PINO_WORKFORCE_CORE:WorkforceTrainingCoreBinding;
  CF_ACCESS_TEAM_DOMAIN:string;
  CF_ACCESS_BO_AUD:string;
}

const PREFIX="workforce/training/";

export function isBoWorkforceTrainingPath(path:string):boolean{return path.startsWith(PREFIX);}

export async function handleBoWorkforceTrainingRequest(request:Request,env:BoWorkforceTrainingEnv,path:string,keyResolver?:JWTVerifyGetKey):Promise<Response>{
  try{
    if(!isAllowed(path,request.method))return json({error:{code:"PLATFORM_NOT_FOUND",message:"BO workforce training operation not found"}},404);
    const identity=stagingBoWorkforceIdentity(request,env)??await authenticateBo(request.headers,{teamDomain:env.CF_ACCESS_TEAM_DOMAIN,audience:env.CF_ACCESS_BO_AUD},keyResolver);
    const method=request.method.toUpperCase(); let body:Record<string,unknown>={}; let idempotencyKey:string|undefined;
    if(method==="GET"){
      const url=new URL(request.url); for(const [key,value] of url.searchParams)body[key]=value;
    }else{
      idempotencyKey=request.headers.get("idempotency-key")?.trim();
      if(!idempotencyKey)return json({error:{code:"PLATFORM_INVALID_INPUT",message:"Idempotency-Key is required"}},400);
      const parsed=await request.json().catch(()=>null);
      if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))return json({error:{code:"PLATFORM_INVALID_INPUT",message:"A JSON request body is required"}},400);
      body=parsed as Record<string,unknown>;
    }
    const corePath=path.slice(PREFIX.length);
    const result=await env.PINO_WORKFORCE_CORE.executeTraining({method,path:corePath,body,...(idempotencyKey?{idempotencyKey}: {})},identity);
    return json(result.body,result.status,{"x-request-id":result.requestId});
  }catch(error){
    if(error instanceof BoAuthError)return json({error:{code:"IDENTITY_AUTHENTICATION_FAILED",message:error.message}},error.status);
    console.error("BO workforce training facade failure",error instanceof Error?error.message:"unknown");
    return json({error:{code:"PLATFORM_INTERNAL_ERROR",message:"An unexpected error occurred"}},500);
  }
}

function isAllowed(path:string,method:string):boolean{
  if(!path.startsWith(PREFIX))return false; const core=path.slice(PREFIX.length); const verb=method.toUpperCase();
  if(verb==="GET")return core==="catalog"||/^staff\/[0-9a-f-]{36}$/.test(core);
  if(verb!=="POST")return false;
  return core==="modules"||core==="assignments"||/^versions\/[0-9a-f-]{36}\/(?:draft|publish)$/.test(core)||/^modules\/[0-9a-f-]{36}\/(?:next-draft|retire)$/.test(core)||/^assignments\/[0-9a-f-]{36}\/signoff$/.test(core)||/^qualifications\/[0-9a-f-]{36}\/revoke$/.test(core);
}
function json(body:unknown,status:number,headers:HeadersInit={}):Response{return Response.json(body,{status,headers:{"cache-control":"no-store",...headers}});}
