import{getCloudflareContext}from"@opennextjs/cloudflare";
import{authenticateWorkforce,WorkforceAuthError}from"@/lib/workforce-auth";
import type{StaffPinCoreBinding}from"@/lib/staff-pin-core";
export const runtime="nodejs";export const dynamic="force-dynamic";
type Env={PINO_STAFF_PIN_CORE:StaffPinCoreBinding;CF_ACCESS_TEAM_DOMAIN:string;CF_ACCESS_TOS_AUD:string};
export async function POST(request:Request){try{const{env}=await getCloudflareContext({async:true})as unknown as{env:Env};await authenticateWorkforce(request.headers,{teamDomain:env.CF_ACCESS_TEAM_DOMAIN,audience:env.CF_ACCESS_TOS_AUD});const token=cookie(request,"pino_staff_session");if(token)await env.PINO_STAFF_PIN_CORE.logout(token);return new Response(null,{status:204,headers:{"set-cookie":"pino_staff_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0"}});}catch(error){if(error instanceof WorkforceAuthError)return Response.json({error:{message:error.message}},{status:error.status});return Response.json({error:{message:"Không thể đăng xuất"}},{status:500});}}
function cookie(request:Request,name:string){return request.headers.get("cookie")?.split(";").map(value=>value.trim()).find(value=>value.startsWith(`${name}=`))?.slice(name.length+1)??"";}
