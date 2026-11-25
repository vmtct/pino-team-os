import {getCloudflareContext} from "@opennextjs/cloudflare";
import {headers} from "next/headers";
import {forbidden,notFound} from "next/navigation";
import {HoWorkspace} from "@/app/ho/HoWorkspace";
import {authorizeHoShell,type HoEnv} from "@/lib/ho-auth";
import {decideM1Preview} from "@/lib/m1-preview/admission.server";
import {normalizeHostname} from "@/lib/host-boundary";
import {LearningSpaceM1Content} from "./LearningSpaceM1Content";
import {SPACE_READ,SPACE_EDIT} from "./schema";
import {parseSpaceReviewQuery} from "./learning-space-m1-preview";
export const dynamic="force-dynamic";
// PAP-2369: approved native M1 shell, Staging-only synthetic operations.
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const params=new URLSearchParams();
 for(const [key,value] of Object.entries(await searchParams)){
   if(["utm_source","utm_medium","utm_campaign","utm_term","utm_content"].includes(key))continue;
   if(typeof value==="string")params.append(key,value);
   else if(Array.isArray(value))for(const item of value)params.append(key,item);
 }
 const query=parseSpaceReviewQuery(params);
 if(!query)notFound();
 const incoming=new Headers(await headers());
 const {env}=await getCloudflareContext({async:true}) as unknown as {env:HoEnv};
 const actor=await authorizeHoShell(incoming,env);
 const review=decideM1Preview({environment:env.APP_ENV,hostname:normalizeHostname(incoming.get("host")||""),surface:"HO",requested:true,featureEnabled:true,authenticated:actor.entitled,surfaceAuthorized:true,scopeAuthorized:true,featureReviewAuthorized:actor.permissionKeys.includes(SPACE_READ)&&actor.permissionKeys.includes(SPACE_EDIT)});
 if(!review.allowed)forbidden();
 return <HoWorkspace module="learningSpaces" content={<LearningSpaceM1Content key={actor.userId} scopeKey={actor.userId} permissionKeys={actor.permissionKeys.filter(k=>k===SPACE_READ||k===SPACE_EDIT)} initialRecord={query.record}/>}/>;
}
