// PAP-1526 / PAP-1362 / PLT-BILL-HO. Exact read facade; no SSR fallback.
import {getCloudflareContext} from "@opennextjs/cloudflare";
import {handleBoBillTableRequest} from "@/lib/bo-bill-table-handler";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request):Promise<Response>{
 const {env}=await getCloudflareContext({async:true});
 return handleBoBillTableRequest(request,env as unknown as Parameters<typeof handleBoBillTableRequest>[1]);
}
const denied=()=>Response.json({error:{message:"Method not allowed"}},{status:405,headers:{"cache-control":"no-store",allow:"GET"}});
export {denied as HEAD,denied as OPTIONS,denied as POST,denied as PUT,denied as PATCH,denied as DELETE};
