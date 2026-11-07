import {getCloudflareContext} from "@opennextjs/cloudflare";
import {handleHoSpecialtyV2Read,type HoSpecialtyV2ReadEnv} from "@/lib/ho-specialty-v2-read-facade";
import {handleHoSpecialtyV2Create,type HoSpecialtyV2CreateEnv} from "@/lib/ho-specialty-v2-create-facade";
export const runtime="nodejs";
/** PAP-1495 / PAP-1491 SPEC-UNLOCK: Founder Catalog GET and 3-field DRAFT Create. */
export async function GET(request:Request):Promise<Response>{
 const {env}=await getCloudflareContext({async:true}) as unknown as {env:HoSpecialtyV2ReadEnv};
 return handleHoSpecialtyV2Read(request,env);
}
export async function POST(request:Request):Promise<Response>{
 const {env}=await getCloudflareContext({async:true}) as unknown as {env:HoSpecialtyV2CreateEnv};
 return handleHoSpecialtyV2Create(request,env);
}
