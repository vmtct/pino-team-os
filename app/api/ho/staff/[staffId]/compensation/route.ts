import {getCloudflareContext} from "@opennextjs/cloudflare";
import {handleHoStaffRateRequest,type HoStaffRateEnv} from "@/lib/ho-staff-rate-facade";
export const runtime="nodejs";
type Context={params:Promise<{staffId:string}>};
async function handle(request:Request,context:Context):Promise<Response>{
 const {env}=await getCloudflareContext({async:true}) as unknown as {env:HoStaffRateEnv};
 const {staffId}=await context.params;
 return handleHoStaffRateRequest(request,env,staffId);
}
export const GET=handle;
export const POST=handle;
