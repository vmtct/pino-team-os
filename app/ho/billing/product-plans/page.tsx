import {getCloudflareContext} from "@opennextjs/cloudflare";
import {headers} from "next/headers";
import {forbidden,notFound} from "next/navigation";
import {HoWorkspace} from "@/app/ho/HoWorkspace";
import {authorizeHoShell,type HoEnv} from "@/lib/ho-auth";
import {normalizeHostname} from "@/lib/host-boundary";
import {ProductPlanNativeEntry} from "./ProductPlanNativeContent";
import {PLAN_READ,PLAN_EDIT} from "./schema";
import {productPlanStageQuery,productPlanActorAllowed} from "./product-plan-stage-admission";
export const dynamic="force-dynamic";
// PAP-2365 / PLT-PRODUCT-PLAN: native Staging only, no runtime fixture fallback.
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const incoming=new Headers(await headers());
 const {env}=await getCloudflareContext({async:true}) as unknown as {env:HoEnv};
 const query=productPlanStageQuery(env.APP_ENV,normalizeHostname(incoming.get("host")||""),await searchParams);
 if(!query)notFound();
 const actor=await authorizeHoShell(incoming,env);
 if(!productPlanActorAllowed(actor))forbidden();
 return <HoWorkspace module="productPlans" content={<ProductPlanNativeEntry key={actor.userId} actorId={actor.userId} permissionKeys={actor.permissionKeys.filter(k=>k===PLAN_READ||k===PLAN_EDIT)} initialRecord={query.record??undefined} initialTab={query.tab}/>}/>;
}
