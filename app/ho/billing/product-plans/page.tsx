import {getCloudflareContext} from "@opennextjs/cloudflare";
import {headers} from "next/headers";
import {forbidden,notFound} from "next/navigation";
import {HoWorkspace} from "@/app/ho/HoWorkspace";
import {authorizeHoShell,type HoEnv} from "@/lib/ho-auth";
import {decideM1Preview} from "@/lib/m1-preview/admission.server";
import {normalizeHostname} from "@/lib/host-boundary";
import {ProductPlanM1Content} from "./ProductPlanM1Content";
import {PLAN_READ,PLAN_EDIT} from "./schema";
export const dynamic="force-dynamic";
// PAP-2183: M1-B is an authenticated synthetic preview, never a live billing writer.
export default async function Page({searchParams}:{searchParams:Promise<{m1Preview?:string|string[];record?:string|string[]}>}){
 const query=await searchParams;
 if((query.m1Preview!==undefined&&query.m1Preview!=="1")||(query.record!==undefined&&(typeof query.record!=="string"||!/^PRODUCT-PLAN-MOCK-[0-9]{3,}$/.test(query.record))))notFound();
 const incoming=new Headers(await headers());
 const {env}=await getCloudflareContext({async:true}) as unknown as {env:HoEnv};
 const actor=await authorizeHoShell(incoming,env);
 const review=decideM1Preview({environment:env.APP_ENV,hostname:normalizeHostname(incoming.get("host")||""),surface:"HO",requested:true,featureEnabled:true,authenticated:actor.entitled,surfaceAuthorized:true,scopeAuthorized:true,featureReviewAuthorized:actor.permissionKeys.includes(PLAN_READ)&&actor.permissionKeys.includes(PLAN_EDIT)});
 if(!review.allowed)forbidden();
 return <HoWorkspace module="productPlans" content={<ProductPlanM1Content key={actor.userId} scopeKey={actor.userId} permissionKeys={actor.permissionKeys.filter(k=>k===PLAN_READ||k===PLAN_EDIT)} initialRecord={typeof query.record==="string"?query.record:undefined}/>}/>;
}
