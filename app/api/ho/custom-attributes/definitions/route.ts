import { getCloudflareContext } from "@opennextjs/cloudflare";
import { hoAttributeDefinitions, type HoAttributeEnv } from "@/lib/ho-attribute-definitions-facade";
export const runtime="nodejs";
/** PAP-1669 / PLT-ATTR — Founder-only GET/List, POST Draft Create. */
export async function GET(request:Request):Promise<Response>{
 const {env}=await getCloudflareContext({async:true}) as unknown as {env:HoAttributeEnv};
 return hoAttributeDefinitions(request,env);
}
export async function POST(request:Request):Promise<Response>{
 const {env}=await getCloudflareContext({async:true}) as unknown as {env:HoAttributeEnv};
 return hoAttributeDefinitions(request,env);
}
