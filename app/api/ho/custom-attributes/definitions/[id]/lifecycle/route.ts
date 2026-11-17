import {getCloudflareContext} from "@opennextjs/cloudflare";
import {hoAttributeDefinitions,type HoAttributeEnv} from "@/lib/ho-attribute-definitions-facade";
export const runtime="nodejs";
/** PAP-1906: exact Founder lifecycle only, host admission must be separately released. */
export async function POST(request:Request):Promise<Response>{
 const {env}=await getCloudflareContext({async:true}) as unknown as {env:HoAttributeEnv};
 return hoAttributeDefinitions(request,env);
}
