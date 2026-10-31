import {getCloudflareContext} from "@opennextjs/cloudflare";
import {handleHoStaffRateRequest,type HoStaffRateEnv} from "@/lib/ho-staff-rate-facade";
export const runtime="nodejs";

type Context={params:Promise<{staffId:string;entryId:string}>};
/** PAP-996: dedicated HO Staging-only versioned correction endpoint. No BO/TOS wage-write capability. */
export async function PATCH(request:Request,context:Context):Promise<Response>{
 const {env}=await getCloudflareContext({async:true}) as unknown as {env:HoStaffRateEnv};
 const {staffId,entryId}=await context.params;
 return handleHoStaffRateRequest(request,env,staffId,entryId);
}
