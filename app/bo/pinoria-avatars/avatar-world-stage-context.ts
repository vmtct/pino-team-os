/** PAP-2153: parse only the actual scoped Core context, never synthesize authority. */
import type {AvatarAuthority} from "./avatar-dsa-data";
import type {BoAccessResponse} from "@/lib/bo-core";
export function parseAvatarWorldStageContext(result:BoAccessResponse,centerId:string):AvatarAuthority|null{
 const body=result.body;
 if(result.status!==200||!body||typeof body!=="object"||!("data" in body))return null;
 const data=body.data;
 if(!data||typeof data!=="object")return null;
 const r=data as Record<string,unknown>;
 if(r.surface!=="BO"||r.entitled!==true||typeof r.userId!=="string"||!r.userId.trim()||!Array.isArray(r.permissionKeys)||r.permissionKeys.some(k=>typeof k!=="string"))return null;
 const grants=new Set<string>(r.permissionKeys);
 if(!grants.has("team.bo.access"))return null;
 return {principalId:r.userId,centerId,grants};
}
