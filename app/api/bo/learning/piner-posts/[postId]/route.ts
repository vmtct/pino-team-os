import {getCloudflareContext} from "@opennextjs/cloudflare";
import {handleBoPostDraftRequest,type BoPostDraftEnv} from "@/lib/bo-post-draft-handler";
export const runtime="nodejs";
export const dynamic="force-dynamic";
async function dispatch(request:Request,context:{params:Promise<{postId:string}>}){const {postId}=await context.params;const {env}=await getCloudflareContext({async:true}) as unknown as {env:BoPostDraftEnv};return handleBoPostDraftRequest(request,env,"learning/piner-posts/"+postId);}
export const GET=dispatch;
export const PATCH=dispatch;
