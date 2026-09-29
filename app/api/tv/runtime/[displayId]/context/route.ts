import { getCloudflareContext } from "@opennextjs/cloudflare";
import { runtimeJson, tvRuntimeCookie, type TvRuntimeCoreBinding } from "@/lib/tv-runtime-core";
export const runtime="nodejs";export const dynamic="force-dynamic";
type Env={PINO_TV_RUNTIME_CORE:TvRuntimeCoreBinding};type Context={params:Promise<{displayId:string}>};
export async function GET(request:Request,context:Context){
  const token=tvRuntimeCookie(request);if(!token)return Response.json({error:{code:"TV_RUNTIME_SESSION_REQUIRED",message:"TV runtime session is required"}},{status:401});
  const {env}=await getCloudflareContext({async:true}) as unknown as {env:Env};const {displayId}=await context.params;
  return runtimeJson(await env.PINO_TV_RUNTIME_CORE.context(token,displayId));
}
