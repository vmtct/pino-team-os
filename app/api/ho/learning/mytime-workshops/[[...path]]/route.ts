import {getCloudflareContext} from "@opennextjs/cloudflare";
import {handleMyTimeWorkshop,type WorkshopEnv} from "@/lib/mytime-workshop-handler";
export const runtime="nodejs";
export const dynamic="force-dynamic";
async function dispatch(request:Request){const {env}=await getCloudflareContext({async:true}) as unknown as {env:WorkshopEnv};return handleMyTimeWorkshop(request,env,"HO");}
export const GET=dispatch;
export const POST=dispatch;
export const PATCH=dispatch;
