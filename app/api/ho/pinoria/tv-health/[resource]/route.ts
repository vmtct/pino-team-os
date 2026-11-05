/** PAP-1418 / PNR-TV — exact HO TV read BFF, Founder only. */
import {getCloudflareContext} from "@opennextjs/cloudflare";
import {handleHoTvRead,type HoTvReadEnv} from "@/lib/ho-tv-read-facade";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request):Promise<Response>{
  const {env}=await getCloudflareContext({async:true}) as unknown as {env:HoTvReadEnv};
  return handleHoTvRead(request,env);
}
