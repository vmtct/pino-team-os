import {getCloudflareContext} from "@opennextjs/cloudflare";
import {handleHoSpecialtyHistoryRead,type HoSpecialtyHistoryEnv} from "@/lib/ho-specialty-v2-history-facade";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Context={params:Promise<{specialtyId:string}>};
export async function GET(request:Request,context:Context):Promise<Response>{
 const {env}=await getCloudflareContext({async:true}) as unknown as {env:HoSpecialtyHistoryEnv};
 const {specialtyId}=await context.params;
 return handleHoSpecialtyHistoryRead(request,env,specialtyId);
}
