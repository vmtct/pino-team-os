import {getCloudflareContext} from "@opennextjs/cloudflare";
import {handleBoPostDraftRequest,type BoPostDraftEnv} from "@/lib/bo-post-draft-handler";
export const runtime="nodejs";
export const dynamic="force-dynamic";
async function dispatch(request:Request){const {env}=await getCloudflareContext({async:true}) as unknown as {env:BoPostDraftEnv};return handleBoPostDraftRequest(request,env,"learning/piner-posts");}
export const GET=dispatch;
export const POST=dispatch;
