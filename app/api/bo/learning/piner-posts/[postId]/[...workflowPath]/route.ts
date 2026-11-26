/** PAP-2386 exact workflow BFF dispatch, no generic forwarding. */
import {getCloudflareContext} from "@opennextjs/cloudflare";
import {handleBoPostWorkflowRequest,matchPostWorkflow} from "@/lib/bo-post-workflow-handler";
import {handleBoPostWorkflowRead,matchPostWorkflowRead} from "@/lib/bo-post-workflow-read-handler";
import type {BoPostDraftEnv} from "@/lib/bo-post-draft-handler";
export const runtime="nodejs";
export const dynamic="force-dynamic";
async function dispatch(request:Request,context:{params:Promise<{postId:string;workflowPath:string[]}>}){
 const {postId,workflowPath}=await context.params;
 const path="learning/piner-posts/"+postId+"/"+workflowPath.join("/");
 const {env}=await getCloudflareContext({async:true}) as unknown as {env:BoPostDraftEnv};
 if(matchPostWorkflowRead(path))return handleBoPostWorkflowRead(request,env,path);
 if(matchPostWorkflow(path))return handleBoPostWorkflowRequest(request,env,path);
 return Response.json({error:{code:"PLATFORM_NOT_FOUND"}},{status:404,headers:{"cache-control":"no-store"}});
}
export const GET=dispatch;
export const POST=dispatch;
