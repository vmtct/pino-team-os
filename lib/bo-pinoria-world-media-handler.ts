/** PAP-2097 / PAP-8 PNR-WORLD — retired BO definition media admission. */
import type {BoAccessCoreBinding} from "./bo-core";
import type {TeamAccessEnv} from "./team-auth";
export interface BoPinoriaWorldMediaEnv extends TeamAccessEnv{PINO_BO_CORE:BoAccessCoreBinding}
export const PINORIA_WORLD_MEDIA_PATH="pinoria/worlds/media";
export async function handleBoPinoriaWorldMediaUpload(request:Request,_env:BoPinoriaWorldMediaEnv):Promise<Response>{
  if(request.method!=="POST")return Response.json({error:{code:"PLATFORM_METHOD_NOT_ALLOWED",message:"Method not allowed"}},{status:405,headers:{"cache-control":"no-store"}});
  return Response.json({error:{code:"ACCESS_PERMISSION_DENIED",message:"World definition writes are restricted to Head Office"}},{status:403,headers:{"cache-control":"no-store"}});
}
