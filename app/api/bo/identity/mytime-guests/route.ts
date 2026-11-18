import {getCloudflareContext} from "@opennextjs/cloudflare";
import {handleBoMyTimeGuestRequest,type BoMyTimeGuestEnv} from "@/lib/bo-mytime-guest-handler";
export const runtime="nodejs";
export const dynamic="force-dynamic";
async function dispatch(request:Request){const {env}=await getCloudflareContext({async:true}) as unknown as {env:BoMyTimeGuestEnv};return handleBoMyTimeGuestRequest(request,env,"identity/mytime-guests");}
export const GET=dispatch;
export const POST=dispatch;
