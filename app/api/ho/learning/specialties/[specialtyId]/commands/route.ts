import {getCloudflareContext} from "@opennextjs/cloudflare";
import {handleHoSpecialtyV2Command,type HoSpecialtyV2CommandEnv} from "@/lib/ho-specialty-v2-command-facade";
export const runtime="nodejs";
/** PAP-1495 / PAP-1491 — explicit HO Founder S5 DRAFT command, not BO TDD writer. */
export async function POST(request:Request,{params}:{params:Promise<{specialtyId:string}>}):Promise<Response>{
 const {env}=await getCloudflareContext({async:true}) as unknown as {env:HoSpecialtyV2CommandEnv};
 const {specialtyId}=await params;
 return handleHoSpecialtyV2Command(request,env,specialtyId);
}
