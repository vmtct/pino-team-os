/** PAP-1874 / PAP-1665 PLT-ATTR FSG4 — Founder read-only Definition History. */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { hoAttributeDefinitions, type HoAttributeEnv } from "@/lib/ho-attribute-definitions-facade";
export const runtime="nodejs";
export async function GET(request:Request):Promise<Response>{
 const {env}=await getCloudflareContext({async:true}) as unknown as {env:HoAttributeEnv};
 return hoAttributeDefinitions(request,env);
}
