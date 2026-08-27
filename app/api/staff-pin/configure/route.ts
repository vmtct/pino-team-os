import{getCloudflareContext}from"@opennextjs/cloudflare";
import{authenticateWorkforce,WorkforceAuthError}from"@/lib/workforce-auth";
import type{StaffPinCoreBinding}from"@/lib/staff-pin-core";
export const runtime="nodejs";export const dynamic="force-dynamic";
type Env={PINO_STAFF_PIN_CORE:StaffPinCoreBinding;CF_ACCESS_TEAM_DOMAIN:string;CF_ACCESS_BO_AUD:string};
export async function POST(request:Request){try{const{env}=await getCloudflareContext({async:true})as unknown as{env:Env};const identity=await authenticateWorkforce(request.headers,{teamDomain:env.CF_ACCESS_TEAM_DOMAIN,audience:env.CF_ACCESS_BO_AUD}),input=await request.json()as{userId?:string;pin?:string},result=await env.PINO_STAFF_PIN_CORE.configure(identity,{userId:input.userId??"",pin:input.pin??""});return Response.json(result.body,{status:result.status,headers:{"cache-control":"no-store","x-request-id":result.requestId}});}catch(error){if(error instanceof WorkforceAuthError)return Response.json({error:{message:error.message}},{status:error.status});return Response.json({error:{message:"Không thể cấu hình PIN"}},{status:500});}}
