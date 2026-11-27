import {getCloudflareContext} from "@opennextjs/cloudflare";
import {handleBoPostMediaRequest} from "@/lib/bo-post-media-handler";
import {handleBoPostWorkflowRequest,matchPostWorkflow} from "@/lib/bo-post-workflow-handler";
import type {BoPostDraftEnv} from "@/lib/bo-post-draft-handler";
export const runtime="nodejs";
export const dynamic="force-dynamic";
async function dispatch(request:Request,context:{params:Promise<{postId:string;mediaPath?:string[]}>}){
 const {postId,mediaPath}=await context.params;
 const {env}=await getCloudflareContext({async:true}) as unknown as {env:BoPostDraftEnv};
 const path="learning/piner-posts/"+postId+"/attachments"+(mediaPath?.length?"/"+mediaPath.join("/"):"");
 if(matchPostWorkflow(path)==="diary-provenance")return handleBoPostWorkflowRequest(request,env,path);
 return handleBoPostMediaRequest(request,env,path);
}
export const GET=dispatch;
export const POST=dispatch;
