import {getCloudflareContext} from "@opennextjs/cloudflare";
import {handleBoPostMediaRequest} from "@/lib/bo-post-media-handler";
import type {BoPostDraftEnv} from "@/lib/bo-post-draft-handler";
export const runtime="nodejs";
export const dynamic="force-dynamic";
async function dispatch(request:Request,context:{params:Promise<{postId:string;mediaPath?:string[]}>}){
 const {postId,mediaPath}=await context.params;
 const {env}=await getCloudflareContext({async:true}) as unknown as {env:BoPostDraftEnv};
 return handleBoPostMediaRequest(request,env,"learning/piner-posts/"+postId+"/attachments"+(mediaPath?.length?"/"+mediaPath.join("/"):""));
}
export const GET=dispatch;
export const POST=dispatch;
