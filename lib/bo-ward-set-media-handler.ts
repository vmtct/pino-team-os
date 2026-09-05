import type {JWTVerifyGetKey} from "jose";
import {authenticateBo,BoAuthError} from "./bo-auth";
import {callBoAccessCore,type BoAccessCoreBinding} from "./bo-core";

export interface BoWardSetMediaEnv{
  PINO_BO_CORE:BoAccessCoreBinding;
  CF_ACCESS_TEAM_DOMAIN:string;
  CF_ACCESS_BO_AUD:string;
}

const PATH="pinoria/ward/set-webm-assets";

export async function handleBoWardSetMediaUpload(request:Request,env:BoWardSetMediaEnv,keyResolver?:JWTVerifyGetKey):Promise<Response>{
  try{
    if(request.method!=="POST")return json({error:{code:"PLATFORM_METHOD_NOT_ALLOWED",message:"Method not allowed"}},405);
    const identity=await authenticateBo(request.headers,{teamDomain:env.CF_ACCESS_TEAM_DOMAIN,audience:env.CF_ACCESS_BO_AUD},keyResolver);
    const idempotencyKey=request.headers.get("idempotency-key")?.trim();
    if(!idempotencyKey)return json({error:{code:"PLATFORM_INVALID_INPUT",message:"Idempotency-Key is required"}},400);
    let form:FormData;try{form=await request.formData();}catch{return json({error:{code:"PLATFORM_INVALID_INPUT",message:"A multipart form body is required"}},400);}
    const file=form.get("file");
    if(!(file instanceof File)||file.size<1||file.size>25*1024*1024)return json({error:{code:"PLATFORM_INVALID_INPUT",message:"WEBM must be between 1 byte and 25 MB"}},400);
    if(file.type!=="video/webm")return json({error:{code:"PLATFORM_INVALID_INPUT",message:"Ward Set upload must be video/webm"}},400);
    const result=await callBoAccessCore(env.PINO_BO_CORE,{method:"POST",path:PATH,body:{fileName:file.name,mimeType:file.type,bytes:await file.arrayBuffer()},idempotencyKey},identity);
    return json(result.body,result.status,{"x-request-id":result.requestId});
  }catch(error){
    if(error instanceof BoAuthError)return json({error:{code:"IDENTITY_AUTHENTICATION_FAILED",message:error.message}},error.status);
    console.error("BO Ward Set media facade failure",error instanceof Error?error.message:"unknown");
    return json({error:{code:"PLATFORM_INTERNAL_ERROR",message:"An unexpected error occurred"}},500);
  }
}

function json(body:unknown,status:number,headers:HeadersInit={}):Response{return Response.json(body,{status,headers:{"cache-control":"no-store",...headers}});}
