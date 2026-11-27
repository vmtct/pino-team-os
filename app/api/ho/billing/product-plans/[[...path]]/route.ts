// PAP-2365 / PLT-PRODUCT-PLAN: exact feature-owned facade; no generic HO mutation.
import {getCloudflareContext} from "@opennextjs/cloudflare";
import {handleHoProductPlans} from "@/lib/ho-product-plan-facade";
import type {HoWorldEnv} from "@/lib/ho-world-handler";
export const runtime="nodejs";
export const dynamic="force-dynamic";
async function handle(request:Request){
 const {env}=await getCloudflareContext({async:true}) as unknown as {env:HoWorldEnv};
 return handleHoProductPlans(request,env);
}
export const GET=handle;
export const PATCH=handle;
