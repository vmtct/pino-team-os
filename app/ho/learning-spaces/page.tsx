import {getCloudflareContext} from "@opennextjs/cloudflare";
import {headers} from "next/headers";
import {forbidden,notFound} from "next/navigation";
import {HoWorkspace} from "@/app/ho/HoWorkspace";
import {authorizeHoShell,type HoEnv} from "@/lib/ho-auth";
import {parseLiveSpaceQuery} from "@/lib/ho-learning-space-contract";

import {LearningSpaceM1Content} from "./LearningSpaceM1Content";
import {SPACE_READ,SPACE_EDIT} from "./schema";

export const dynamic="force-dynamic";
// PAP-2371: canonical real integration; existing server admission remains authoritative.
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const params=new URLSearchParams();
 for(const [key,value] of Object.entries(await searchParams)){
   if(["utm_source","utm_medium","utm_campaign","utm_term","utm_content"].includes(key))continue;
   if(typeof value==="string")params.append(key,value);
   else if(Array.isArray(value))for(const item of value)params.append(key,item);
 }
 const query=parseLiveSpaceQuery(params);
 if(!query)notFound();
 const incoming=new Headers(await headers());
 const {env}=await getCloudflareContext({async:true}) as unknown as {env:HoEnv};
 const actor=await authorizeHoShell(incoming,env);
 if(!actor.entitled||!actor.permissionKeys.includes(SPACE_READ))forbidden();
 return <HoWorkspace module="learningSpaces" content={<LearningSpaceM1Content key={actor.userId} scopeKey={actor.userId} permissionKeys={actor.permissionKeys.filter(k=>k===SPACE_READ||k===SPACE_EDIT)} initialRecord={query.record}/>}/>;
}
