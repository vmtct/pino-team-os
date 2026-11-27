/** PAP-2404 feature-owned route candidate; host gate and private binding admission separate. */
import {getCloudflareContext} from "@opennextjs/cloudflare";
import {handleHoEditorialRequest,type HoEditorialEnv} from "@/lib/ho-editorial-handler";
export const runtime="nodejs";
export const dynamic="force-dynamic";
async function handle(request:Request){
 const {env}=await getCloudflareContext({async:true}) as unknown as {env:HoEditorialEnv};
 return handleHoEditorialRequest(request,env);
}
export const GET=handle;
export const POST=handle;
