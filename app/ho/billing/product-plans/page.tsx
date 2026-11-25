import {getCloudflareContext} from "@opennextjs/cloudflare";
import {headers} from "next/headers";
import {forbidden,notFound,redirect} from "next/navigation";
import {HoWorkspace} from "@/app/ho/HoWorkspace";
import {authorizeHoShell,type HoEnv} from "@/lib/ho-auth";
import {decideM1Preview} from "@/lib/m1-preview/admission.server";
import {normalizeHostname} from "@/lib/host-boundary";
import {ProductPlanM1Content} from "./ProductPlanM1Content";
import {PLAN_READ,PLAN_EDIT} from "./schema";
import {PRODUCT_PLAN_REVIEW_PATH,parseProductPlanReviewQuery} from "./product-plan-m1-preview";
export const dynamic="force-dynamic";
// PAP-2183: M1-B is an authenticated synthetic preview, never a live billing writer.
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const params=new URLSearchParams();
 for(const [key,value] of Object.entries(await searchParams)){
   if(typeof value==="string")params.append(key,value);
   else if(Array.isArray(value))for(const item of value)params.append(key,item);
 }
 const query=parseProductPlanReviewQuery(params,true);
 if(!query)notFound();
 const incoming=new Headers(await headers());
 const {env}=await getCloudflareContext({async:true}) as unknown as {env:HoEnv};
 const actor=await authorizeHoShell(incoming,env);
 const review=decideM1Preview({environment:env.APP_ENV,hostname:normalizeHostname(incoming.get("host")||""),surface:"HO",requested:true,featureEnabled:true,authenticated:actor.entitled,surfaceAuthorized:true,scopeAuthorized:true,featureReviewAuthorized:actor.permissionKeys.includes(PLAN_READ)&&actor.permissionKeys.includes(PLAN_EDIT)});
 if(!review.allowed)forbidden();
 if(query.legacy)redirect(PRODUCT_PLAN_REVIEW_PATH+(query.record?"?record="+encodeURIComponent(query.record):""));
 return <HoWorkspace module="productPlans" content={<ProductPlanM1Content key={actor.userId} scopeKey={actor.userId} permissionKeys={actor.permissionKeys.filter(k=>k===PLAN_READ||k===PLAN_EDIT)} initialRecord={query.record}/>}/>;
}
