import { getCloudflareContext } from "@opennextjs/cloudflare";
import { hoAttributeDefinitions, type HoAttributeEnv } from "@/lib/ho-attribute-definitions-facade";
export const runtime="nodejs";
/** PAP-1669 / PLT-ATTR — Founder-only canonical definition readback. */
export async function GET(request:Request):Promise<Response>{
 const {env}=await getCloudflareContext({async:true}) as unknown as {env:HoAttributeEnv};
 return hoAttributeDefinitions(request,env);
}
