import{getCloudflareContext}from"@opennextjs/cloudflare";
import{authenticateWorkforce,WorkforceAuthError}from"@/lib/workforce-auth";
import type{PinoriaTvCoreBinding}from"@/lib/staff-pin-core";
export const runtime="nodejs";export const dynamic="force-dynamic";
type Env={PINO_PINORIA_TV_CORE:PinoriaTvCoreBinding;CF_ACCESS_TEAM_DOMAIN:string;CF_ACCESS_TOS_AUD:string};
export async function GET(request:Request){try{const{env}=await getCloudflareContext({async:true})as unknown as{env:Env};await authenticateWorkforce(request.headers,{teamDomain:env.CF_ACCESS_TEAM_DOMAIN,audience:env.CF_ACCESS_TOS_AUD});const centerId=new URL(request.url).searchParams.get("centerId")??"";return Response.json({data:await env.PINO_PINORIA_TV_CORE.snapshot(centerId)},{headers:{"cache-control":"no-store"}});}catch(error){if(error instanceof WorkforceAuthError)return Response.json({error:{message:error.message}},{status:error.status});return Response.json({error:{message:"Không tải được Pinoria House"}},{status:500});}}
