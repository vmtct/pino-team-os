import { getCloudflareContext } from "@opennextjs/cloudflare";
import { mergePresenceWardSessions } from "@/app/pinoria-tv/presence-contract";
import { tvRuntimeCookie, type TvRuntimeCoreBinding } from "@/lib/tv-runtime-core";
export const runtime="nodejs";export const dynamic="force-dynamic";
type Env={PINO_TV_RUNTIME_CORE:TvRuntimeCoreBinding};type Context={params:Promise<{displayId:string}>};
export async function GET(request:Request,context:Context){
  const token=tvRuntimeCookie(request);if(!token)return Response.json({error:{code:"TV_RUNTIME_SESSION_REQUIRED",message:"TV runtime session is required"}},{status:401});
  const {env}=await getCloudflareContext({async:true}) as unknown as {env:Env};const {displayId}=await context.params;
  const result=await env.PINO_TV_RUNTIME_CORE.snapshot(token,displayId);
  if(result.status!==200)return Response.json(result.body,{status:result.status,headers:{"cache-control":"no-store","x-request-id":result.requestId}});
  const body=result.body as {data?:{presence?:unknown;house?:unknown}};
  if(!body.data)return Response.json({error:{code:"TV_RUNTIME_INVALID_RESPONSE",message:"TV runtime snapshot is unavailable"}},{status:503});
  return Response.json({data:mergePresenceWardSessions(body.data.presence,body.data.house)},{headers:{"cache-control":"no-store","x-request-id":result.requestId}});
}
