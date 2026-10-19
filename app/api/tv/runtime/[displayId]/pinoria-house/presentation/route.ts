import { getCloudflareContext } from "@opennextjs/cloudflare";
import { runtimeJson, tvRuntimeCookie, type TvRuntimeCoreBinding } from "@/lib/tv-runtime-core";

export const runtime="nodejs";
export const dynamic="force-dynamic";

type Env={PINO_TV_RUNTIME_CORE:TvRuntimeCoreBinding};
type Context={params:Promise<{displayId:string}>};
type RuntimeEnvelope={data?:unknown};

function adaptedJson(body:unknown,status:number,requestId:string){
  return Response.json(body,{status,headers:{"cache-control":"no-store","x-request-id":requestId}});
}

export async function POST(request:Request,context:Context){
  const token=tvRuntimeCookie(request);
  if(!token)return Response.json({error:{code:"TV_RUNTIME_SESSION_REQUIRED",message:"TV runtime session is required"}},{status:401});
  const {env}=await getCloudflareContext({async:true}) as unknown as {env:Env};
  const {displayId}=await context.params;
  const body=await request.json().catch(()=>({})) as Record<string,unknown>;
  if(body.op==="claim"){
    const result=await env.PINO_TV_RUNTIME_CORE.claimPresentation(token,displayId);
    if(result.status!==200)return runtimeJson(result);
    const envelope=result.body as RuntimeEnvelope;
    return adaptedJson({presentation:envelope.data??null},200,result.requestId);
  }
  if(body.op==="status"){
    const result=await env.PINO_TV_RUNTIME_CORE.presentationStatus(token,displayId);
    if(result.status!==200)return runtimeJson(result);
    const envelope=result.body as RuntimeEnvelope;
    const data=envelope.data;
    // The runtime session permits a minimal active-ID read only; no private projection.
    if(!data||typeof data!=="object"||Array.isArray(data)||!("activePresentationId" in data)){
      return adaptedJson({error:{code:"TV_PRESENTATION_STATUS_UNAVAILABLE",message:"TV status unavailable"}},503,result.requestId);
    }
    const active=(data as {activePresentationId:unknown}).activePresentationId;
    if(active!==null&&(typeof active!=="string"||!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(active))){
      return adaptedJson({error:{code:"TV_PRESENTATION_STATUS_UNAVAILABLE",message:"TV status unavailable"}},503,result.requestId);
    }
    return adaptedJson({ok:true,activePresentationId:active},200,result.requestId);
  }  if(body.op==="complete"&&typeof body.presentationId==="string"){
    const result=await env.PINO_TV_RUNTIME_CORE.completePresentation(token,displayId,body.presentationId);
    if(result.status!==200)return runtimeJson(result);
    const envelope=result.body as RuntimeEnvelope;
    const completed=envelope.data;
    return adaptedJson(
      completed&&typeof completed==="object"&&!Array.isArray(completed)
        ? {ok:true,...completed as Record<string,unknown>}
        : {ok:true},
      200,
      result.requestId,
    );
  }
  return Response.json({error:{code:"PLATFORM_INVALID_INPUT",message:"Unsupported presentation operation"}},{status:400});
}
