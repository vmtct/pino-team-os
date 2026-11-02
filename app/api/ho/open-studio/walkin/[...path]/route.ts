import {getCloudflareContext} from "@opennextjs/cloudflare";
import {authorizeHoShell,type HoEnv} from "@/lib/ho-auth";
import {BoShellGateError} from "@/lib/bo-shell-gate";
import {callBoAccessCoreWithCredential,type BoAccessCoreBinding} from "@/lib/bo-core";
import {teamCredential,TeamAuthError,type TeamAccessEnv} from "@/lib/team-auth";
export const runtime="nodejs",dynamic="force-dynamic";
type Env=HoEnv&TeamAccessEnv&{PINO_BO_CORE:BoAccessCoreBinding};
type Context={params:Promise<{path:string[]}>};
async function handle(request:Request,context:Context):Promise<Response>{
 try{
  const {env}=await getCloudflareContext({async:true}) as unknown as {env:Env};
  const op=(await context.params).path.join("/"),method=request.method;
  if(!((op==="inventory"&&method==="GET")||(["batches","revoke"].includes(op)&&method==="POST")))
   return Response.json({error:{code:"PLATFORM_NOT_FOUND"}},{status:404});
  await authorizeHoShell(request.headers,env);
  const credential=await teamCredential(request,env,"BO");
  let corePath="open-studio/walkin/"+op;
  if(method==="GET"){
   const q=new URL(request.url).searchParams;
   if([...q.keys()].some(k=>k!=="limit"||q.getAll(k).length!==1))return Response.json({error:{code:"PLATFORM_INVALID_INPUT"}},{status:400});
   if(q.has("limit"))corePath+="?limit="+encodeURIComponent(q.get("limit")!);
  }
  let body:Record<string,unknown>|undefined;
  if(method==="POST"){
   const raw=await request.text();
   if(raw.length>8000)return Response.json({error:{code:"PLATFORM_INVALID_INPUT"}},{status:400});
   let value:unknown;
   try{value=JSON.parse(raw)}catch{return Response.json({error:{code:"PLATFORM_INVALID_INPUT"}},{status:400})}
   if(!value||typeof value!=="object"||Array.isArray(value))return Response.json({error:{code:"PLATFORM_INVALID_INPUT"}},{status:400});
   body=value as Record<string,unknown>;
   if(Object.keys(body).some(k=>!(op==="batches"?["name","quantity"]:["passId"]).includes(k)))return Response.json({error:{code:"PLATFORM_INVALID_INPUT"}},{status:400});
  }
  const result=await callBoAccessCoreWithCredential(env.PINO_BO_CORE,{method,path:corePath,...(body?{body}:{}),...(request.headers.get("idempotency-key")?{idempotencyKey:request.headers.get("idempotency-key")!}:{})},credential);
  return Response.json(result.body,{status:result.status,headers:{"cache-control":"no-store","x-request-id":result.requestId}});
 }catch(e){
  if(e instanceof BoShellGateError)return Response.json({error:{code:"HO_ACCESS_DENIED"}},{status:e.status});
  if(e instanceof TeamAuthError)return Response.json({error:{code:"IDENTITY_AUTHENTICATION_FAILED"}},{status:e.status});
  return Response.json({error:{code:"PLATFORM_INTERNAL_ERROR"}},{status:500});
 }
}
export const GET=handle,POST=handle;
