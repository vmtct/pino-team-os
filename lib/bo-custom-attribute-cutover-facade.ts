// PAP-2098 / PLT-ATTR — exact BO Staging BFF forwarding, not an authority.
// Core owns verified Founder, server admission, CAS and audit.
import {callBoAccessCoreWithCredential,type BoAccessCoreBinding,type BoAccessRequest} from "./bo-core";
import {teamCredential,TeamAuthError,type TeamAccessEnv} from "./team-auth";
import {BO_STAGING_HOSTNAME,normalizeHostname} from "./host-boundary";
const root="access/custom-attribute-cutover";
const policy="PAP-2098-ONE-SHOT-STAGING-CUSTOM-ATTRIBUTE";
export interface BoCutoverEnv extends TeamAccessEnv {APP_ENV?:string;PINO_BO_CORE:BoAccessCoreBinding}
export function isBoCutoverPath(path:string):boolean{return /^access\/custom-attribute-cutover(?:\/|$)/i.test(path);}
export function isExactBoCutoverMethod(path:string,method:string):boolean{
 return path===root+"/preview"&&method==="GET"||path===root+"/execute"&&method==="POST";
}
function reply(body:unknown,status:number,requestId?:string):Response{
 return Response.json(body,{status,headers:{"cache-control":"no-store",...(requestId?{"x-request-id":requestId}:{})}});
}
function error(status:number,code:string){return reply({error:{code}},status);}
export async function handleBoCutoverRequest(request:Request,env:BoCutoverEnv,path:string):Promise<Response>{
 const url=new URL(request.url);
 if(env.APP_ENV!=="staging"||url.protocol!=="https:"||url.host!==BO_STAGING_HOSTNAME||
  normalizeHostname(request.headers.get("host")||url.hostname)!==BO_STAGING_HOSTNAME||
  url.pathname!=="/api/bo/"+path||url.search||url.hash||url.username||url.password||
  (path!==root+"/preview"&&path!==root+"/execute"))return error(404,"PLATFORM_NOT_FOUND");
 if(!isExactBoCutoverMethod(path,request.method))return error(405,"PLATFORM_METHOD_NOT_ALLOWED");
 const origin=request.headers.get("origin");
 if(origin!==null&&origin!=="https://"+BO_STAGING_HOSTNAME)return error(403,"PLATFORM_FORBIDDEN");
 if(request.method==="POST"&&(origin!=="https://"+BO_STAGING_HOSTNAME||
  request.headers.get("content-type")?.split(";")[0].trim().toLowerCase()!=="application/json"))return error(403,"PLATFORM_FORBIDDEN");
 try{
  const credential=await teamCredential(request,env,"BO");
  if(credential.kind!=="password")return error(403,"PLATFORM_FORBIDDEN");
  const forward:BoAccessRequest={method:request.method,path};
  if(request.method==="POST"){
   let raw:unknown;
   try{const text=await request.text();if(text.length>512)return error(400,"PLATFORM_INVALID_INPUT");raw=JSON.parse(text);}
   catch{return error(400,"PLATFORM_INVALID_INPUT");}
   if(!raw||typeof raw!=="object"||Array.isArray(raw))return error(400,"PLATFORM_INVALID_INPUT");
   const body=raw as Record<string,unknown>;
   if(Object.keys(body).length!==2||body.policy!==policy||typeof body.digest!=="string"||!/^[a-f0-9]{64}$/.test(body.digest))return error(400,"PLATFORM_INVALID_INPUT");
   forward.body={policy,digest:body.digest};
  }
  const result=await callBoAccessCoreWithCredential(env.PINO_BO_CORE,forward,credential);
  return reply(result.body,result.status,result.requestId);
 }catch(e){if(e instanceof TeamAuthError)return error(e.status,"IDENTITY_AUTHENTICATION_FAILED");return error(503,"CUTOVER_UNAVAILABLE");}
}
