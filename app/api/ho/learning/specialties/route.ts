import {getCloudflareContext} from "@opennextjs/cloudflare";
import {handleHoSpecialtyV2Read,type HoSpecialtyV2ReadEnv} from "@/lib/ho-specialty-v2-read-facade";
export const runtime="nodejs";
/** PAP-1495 / PAP-1491 SPEC-UNLOCK: Founder-only bounded read. */
export async function GET(request:Request):Promise<Response>{
 const {env}=await getCloudflareContext({async:true}) as unknown as {env:HoSpecialtyV2ReadEnv};
 return handleHoSpecialtyV2Read(request,env);
}
