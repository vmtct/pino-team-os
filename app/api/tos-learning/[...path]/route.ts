import{getCloudflareContext}from"@opennextjs/cloudflare";
import{authenticateWorkforce,WorkforceAuthError}from"@/lib/workforce-auth";
import{stagingWorkforceIdentity,type TosStagingAuthEnv}from"@/lib/tos-staging-auth";
import{callTosLearningCore,callTosLearningCoreWithStaffPin,type TosLearningCoreBinding}from"@/lib/tos-learning-core";

export const runtime="nodejs";
export const dynamic="force-dynamic";

type Context={params:Promise<{path:string[]}>};
type TosLearningEnv=TosStagingAuthEnv&{
  PINO_TOS_LEARNING_CORE:TosLearningCoreBinding;
  CF_ACCESS_TEAM_DOMAIN:string;
  CF_ACCESS_TOS_AUD:string;
};

async function handle(request:Request,context:Context){
  try{
    const{env}=await getCloudflareContext({async:true}) as unknown as{env:TosLearningEnv};
    const staffToken=cookie(request,"pino_staff_session");
    const stagingIdentity=stagingWorkforceIdentity(request,env);
    const identity=stagingIdentity??(staffToken?null:await authenticateWorkforce(request.headers,{teamDomain:env.CF_ACCESS_TEAM_DOMAIN,audience:env.CF_ACCESS_TOS_AUD}));
    const{path}=await context.params;
    let body:Record<string,unknown>={};
    const url=new URL(request.url);
    for(const[key,value]of url.searchParams)if(key!=="t")body[key]=value;
    if(request.method!=="GET"&&request.method!=="HEAD"){const parsed=await request.json().catch(()=>({}));if(parsed&&typeof parsed==="object"&&!Array.isArray(parsed))body={...body,...parsed};}
    const idempotencyKey=request.headers.get("idempotency-key")??undefined;
    const coreRequest={method:request.method,path:`/${path.join("/")}`,body,...(idempotencyKey?{idempotencyKey}:{})};
    const result=staffToken
      ?await callTosLearningCoreWithStaffPin(env.PINO_TOS_LEARNING_CORE,coreRequest,staffToken)
      :await callTosLearningCore(env.PINO_TOS_LEARNING_CORE,coreRequest,identity!);
    return Response.json(result.body,{status:result.status,headers:{"cache-control":"no-store","x-request-id":result.requestId}});
  }catch(error){
    if(error instanceof WorkforceAuthError)return Response.json({error:{code:"IDENTITY_AUTHENTICATION_FAILED",message:error.message}},{status:error.status,headers:{"cache-control":"no-store"}});
    console.error("TOS learning facade failure",error instanceof Error?error.message:"unknown");
    return Response.json({error:{code:"PLATFORM_INTERNAL_ERROR",message:"An unexpected error occurred"}},{status:500,headers:{"cache-control":"no-store"}});
  }
}
function cookie(request:Request,name:string){return request.headers.get("cookie")?.split(";").map(value=>value.trim()).find(value=>value.startsWith(`${name}=`))?.slice(name.length+1)??"";}

export const GET=handle;
export const POST=handle;
export const PUT=handle;
export const PATCH=handle;
