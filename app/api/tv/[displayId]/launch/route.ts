import { getCloudflareContext } from "@opennextjs/cloudflare";
import { staffPinSession } from "@/lib/local-staff-session";
import { teamCredential, TeamAuthError, type TeamAccessEnv } from "@/lib/team-auth";
import { callTosLearningCoreWithCredential, callTosLearningCoreWithStaffPin, type TosLearningCoreBinding } from "@/lib/tos-learning-core";
import { TV_RUNTIME_COOKIE } from "@/lib/tv-runtime-core";

export const runtime="nodejs"; export const dynamic="force-dynamic";
type Env=TeamAccessEnv&{PINO_TOS_LEARNING_CORE:TosLearningCoreBinding};
type Context={params:Promise<{displayId:string}>};

export async function POST(request:Request,context:Context){
  try{
    const {env}=await getCloudflareContext({async:true}) as unknown as {env:Env};
    const {displayId}=await context.params;
    const body=await request.json().catch(()=>({})) as Record<string,unknown>;
    const coreRequest={method:"POST",path:`/tv/displays/${displayId}/launch`,body:{...(typeof body.deviceId==="string"?{deviceId:body.deviceId}:{})}};
    const pin=staffPinSession(request);
    const result=pin
      ?await callTosLearningCoreWithStaffPin(env.PINO_TOS_LEARNING_CORE,coreRequest,pin)
      :await callTosLearningCoreWithCredential(env.PINO_TOS_LEARNING_CORE,coreRequest,await teamCredential(request,env,"TOS"));
    if(result.status!==201)return Response.json(result.body,{status:result.status,headers:{"cache-control":"no-store","x-request-id":result.requestId}});
    const envelope=result.body as {data?:{runtimeToken?:string;session?:unknown}};
    const token=envelope.data?.runtimeToken?.trim()??"";
    if(!token)throw new Error("TV_RUNTIME_TOKEN_MISSING");
    const response=Response.json({data:{session:envelope.data?.session??null}},{status:201,headers:{"cache-control":"no-store","x-request-id":result.requestId}});
    response.headers.append("set-cookie",`${TV_RUNTIME_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=43200`);
    return response;
  }catch(error){
    if(error instanceof TeamAuthError)return Response.json({error:{code:"IDENTITY_AUTHENTICATION_FAILED",message:error.message}},{status:error.status});
    console.error("TV launch facade failure",error instanceof Error?error.message:"unknown");
    return Response.json({error:{code:"PLATFORM_INTERNAL_ERROR",message:"Unable to launch TV"}},{status:500});
  }
}
