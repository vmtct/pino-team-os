import {getCloudflareContext} from "@opennextjs/cloudflare";
import {handleHoWorldRequest,type HoWorldEnv} from "@/lib/ho-world-handler";
export const runtime="nodejs";
export const dynamic="force-dynamic";
async function handle(request:Request){const {env}=await getCloudflareContext({async:true}) as unknown as {env:HoWorldEnv};return handleHoWorldRequest(request,env);}
export const POST=handle;
export const PATCH=handle;
export const PUT=handle;
