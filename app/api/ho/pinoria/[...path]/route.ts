import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleHoPinoriaItemRequest, type HoItemEnv } from "@/lib/ho-pinoria-item-handler";
export const runtime="nodejs";
export const dynamic="force-dynamic";
async function handle(request:Request):Promise<Response>{
  const {env}=await getCloudflareContext({async:true}) as unknown as {env:HoItemEnv};
  return handleHoPinoriaItemRequest(request,env);
}
export const GET=handle;
export const POST=handle;
export const PATCH=handle;
