import {getCloudflareContext} from "@opennextjs/cloudflare";
import {handleHoSpecialtyV2Read,type HoSpecialtyV2ReadEnv} from "@/lib/ho-specialty-v2-read-facade";
import {handleHoSpecialtyV2MetadataPut,type HoSpecialtyV2MetadataEnv} from "@/lib/ho-specialty-v2-metadata-facade";
export const runtime="nodejs";
/** PAP-1495 / PAP-1491 SPEC-UNLOCK: V2 Founder read and DRAFT metadata-only PUT. */
export async function GET(request:Request,{params}:{params:Promise<{specialtyId:string}>}):Promise<Response>{
 const {env}=await getCloudflareContext({async:true}) as unknown as {env:HoSpecialtyV2ReadEnv};
 const {specialtyId}=await params;
 return handleHoSpecialtyV2Read(request,env,specialtyId);
}
export async function PUT(request:Request,{params}:{params:Promise<{specialtyId:string}>}):Promise<Response>{
 const {env}=await getCloudflareContext({async:true}) as unknown as {env:HoSpecialtyV2MetadataEnv};
 const {specialtyId}=await params;
 return handleHoSpecialtyV2MetadataPut(request,env,specialtyId);
}
