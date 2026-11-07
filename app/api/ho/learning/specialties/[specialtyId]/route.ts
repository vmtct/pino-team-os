import {getCloudflareContext} from "@opennextjs/cloudflare";
import {handleHoSpecialtyV2Read,type HoSpecialtyV2ReadEnv} from "@/lib/ho-specialty-v2-read-facade";
export const runtime="nodejs";
/** PAP-1495 / PAP-1491 SPEC-UNLOCK: V2 Founder detail, no writer. */
export async function GET(request:Request,{params}:{params:Promise<{specialtyId:string}>}):Promise<Response>{
 const {env}=await getCloudflareContext({async:true}) as unknown as {env:HoSpecialtyV2ReadEnv};
 const {specialtyId}=await params;
 return handleHoSpecialtyV2Read(request,env,specialtyId);
}
