// PAP-1625 / PNR-WARD FG2: exact host-scoped Create Self facade.
import { callBoAccessCoreWithCredential, type BoAccessCoreBinding, type BoAccessRequest } from "./bo-core";
import { teamCredential, TeamAuthError, type TeamAccessEnv } from "./team-auth";
export type BoSelfCreateEnv=TeamAccessEnv&{PINO_BO_CORE:BoAccessCoreBinding};
const V7=/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const result=(body:unknown,status:number,requestId?:string)=>Response.json(body,{status,headers:{"cache-control":"no-store",...(requestId?{"x-request-id":requestId}:{})}});
class Invalid extends Error {}
export async function handleBoSelfCreateRequest(request:Request,env:BoSelfCreateEnv,path:string,
 keyResolver?:Parameters<typeof teamCredential>[3]):Promise<Response>{
 try{
  if(path!=="pinoria/avatars")return result({error:{code:"PLATFORM_NOT_FOUND"}},404);
  if(request.method!=="POST")return result({error:{code:"PLATFORM_METHOD_NOT_ALLOWED"}},405);
  const params=[...new URL(request.url).searchParams.entries()];
  if(params.length!==1||params[0]?.[0]!=="centerId"||!V7.test(params[0][1]))throw new Invalid("Exactly one selected canonical Center is required");
  if(!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))throw new Invalid("JSON body required");
  let payload:unknown;
  try{payload=await request.json()}catch{throw new Invalid("Valid JSON required")}
  if(!payload||typeof payload!=="object"||Array.isArray(payload)||Object.keys(payload).length!==1||
     !("personId" in payload)||typeof payload.personId!=="string"||!V7.test(payload.personId))
    throw new Invalid("Select an eligible canonical Person");
  const credential=await teamCredential(request,env,"BO",keyResolver);
  const req:BoAccessRequest={method:"POST",path,resource:{centerId:params[0][1]},body:{personId:payload.personId}};
  const core=await callBoAccessCoreWithCredential(env.PINO_BO_CORE,req,credential);
  return result(core.body,core.status,core.requestId);
 }catch(error){
  if(error instanceof TeamAuthError)return result({error:{code:"IDENTITY_AUTHENTICATION_FAILED",message:error.message}},error.status);
  if(error instanceof Invalid)return result({error:{code:"PLATFORM_INVALID_INPUT",message:error.message}},400);
  console.error("PAP-1625 Create Self facade failure",error instanceof Error?error.name:"unknown");
  return result({error:{code:"PLATFORM_INTERNAL_ERROR",message:"An unexpected error occurred"}},500);
 }
}
