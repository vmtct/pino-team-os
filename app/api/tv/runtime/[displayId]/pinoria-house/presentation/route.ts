import { handleTvRuntimePresentationStatus } from "./status-handler";
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
    return handleTvRuntimePresentationStatus(token,displayId,env.PINO_TV_RUNTIME_CORE);
  }
  if(body.op==="replay-pending"){
    const result=await env.PINO_TV_RUNTIME_CORE.pendingReplay(token,displayId);
    if(result.status!==200)return runtimeJson(result);
    return adaptedJson(result.body,200,result.requestId);
  }
  if(body.op==="replay-projection"){
    const commandId=typeof body.commandId==="string"?body.commandId:"";
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(commandId)){
      return Response.json({error:{code:"PLATFORM_INVALID_INPUT",message:"Invalid replay command"}},{status:400});
    }
    const result=await env.PINO_TV_RUNTIME_CORE.replayProjection(token,displayId,commandId);
    if(result.status!==200)return runtimeJson(result);
    return adaptedJson(result.body,200,result.requestId);
  }
  if(body.op==="replay-ack"){
    const commandId=typeof body.commandId==="string"?body.commandId:"";
    const revision=body.revision;
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(commandId)||
      !Number.isSafeInteger(revision)||!(typeof revision==="number"&&revision>0)){
      return Response.json({error:{code:"PLATFORM_INVALID_INPUT",message:"Invalid replay acknowledgement"}},{status:400});
    }
    const result=await env.PINO_TV_RUNTIME_CORE.acknowledgeReplay(token,displayId,commandId,revision);
    if(result.status!==200)return runtimeJson(result);
    return adaptedJson(result.body,200,result.requestId);
  }
  if(body.op==="complete"&&typeof body.presentationId==="string"){
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
