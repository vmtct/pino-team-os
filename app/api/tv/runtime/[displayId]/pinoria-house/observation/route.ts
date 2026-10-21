import { getCloudflareContext } from "@opennextjs/cloudflare";
import { runtimeJson, tvRuntimeCookie, type TvRuntimeCoreBinding } from "@/lib/tv-runtime-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = {params:Promise<{displayId:string}>};
type Env = {PINO_TV_RUNTIME_CORE:TvRuntimeCoreBinding};

export async function POST(request:Request,context:Context) {
  const token = tvRuntimeCookie(request);
  if (!token) return Response.json({error:{code:"TV_RUNTIME_SESSION_REQUIRED"}},{status:401,headers:{"cache-control":"no-store"}});
  const {displayId} = await context.params;
  const report = await request.json().catch(() => null) as unknown;
  if (!report || typeof report !== "object" || Array.isArray(report)) {
    return Response.json({error:{code:"INVALID_OBSERVATION"}},{status:400,headers:{"cache-control":"no-store"}});
  }
  const {env} = await getCloudflareContext({async:true}) as unknown as {env:Env};
  // Never accept a caller-selected center, token or session outside Core's strict report validator.
  return runtimeJson(await env.PINO_TV_RUNTIME_CORE.validateRuntimeObservation(token,displayId,report));
}
