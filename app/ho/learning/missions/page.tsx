import {getCloudflareContext} from "@opennextjs/cloudflare";
import {headers} from "next/headers";
import {forbidden,notFound} from "next/navigation";
import {authorizeHoShell,type HoEnv} from "@/lib/ho-auth";
import {normalizeHostname} from "@/lib/host-boundary";
import {decideM1Preview} from "@/lib/m1-preview/admission.server";
import {HoMissionsTddPreview} from "./HoMissionsTdd";
import {parseMissionM1Query,hasMissionM1Permissions,MISSION_M1_READ,MISSION_M1_EDIT} from "./mission-m1-query";
export const dynamic="force-dynamic";
/** PAP-2394 — canonical server-owned M1-B. All writes are isolated preview writes. */
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const params=new URLSearchParams();
 for(const [key,value] of Object.entries(await searchParams)){
  if(typeof value==="string")params.append(key,value);
  else if(Array.isArray(value))for(const item of value)params.append(key,item);
 }
 const query=parseMissionM1Query(params);
 if(!query)notFound();
 const incoming=new Headers(await headers());
 const {env}=await getCloudflareContext({async:true}) as unknown as {env:HoEnv};
 const actor=await authorizeHoShell(incoming,env);
 const admission=decideM1Preview({environment:env.APP_ENV,hostname:normalizeHostname(incoming.get("host")||""),surface:"HO",requested:true,featureEnabled:true,authenticated:actor.entitled,surfaceAuthorized:true,scopeAuthorized:true,featureReviewAuthorized:hasMissionM1Permissions(actor.permissionKeys)});
 if(!admission.allowed)forbidden();
 return <HoMissionsTddPreview key={actor.userId+":"+(query.record??"")} scopeKey={actor.userId} permissionKeys={actor.permissionKeys.filter(k=>k===MISSION_M1_READ||k===MISSION_M1_EDIT)} initialRecord={query.record}/>;
}
