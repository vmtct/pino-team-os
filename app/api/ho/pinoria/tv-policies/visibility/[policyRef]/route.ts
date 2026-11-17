/** PAP-1385 / PNR-TV: private HO Founder visibility ingress, Staging only. */
import {getCloudflareContext} from "@opennextjs/cloudflare";
import {handleHoTvVisibility,type HoTvVisibilityEnv} from "@/lib/ho-tv-visibility-facade";
export const runtime="nodejs";
export const dynamic="force-dynamic";
async function handle(request:Request):Promise<Response>{
  const {env}=await getCloudflareContext({async:true}) as unknown as {env:HoTvVisibilityEnv};
  return handleHoTvVisibility(request,env);
}
export const GET=handle;
export const PATCH=handle;
