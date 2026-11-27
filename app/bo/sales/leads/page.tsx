import {getCloudflareContext} from "@opennextjs/cloudflare";
import {headers} from "next/headers";
import {forbidden,notFound,redirect} from "next/navigation";
import {authorizeBoShell,type BoShellGateEnv} from "@/lib/bo-shell-gate";
import {teamCredentialFromHeaders,TeamAuthError} from "@/lib/team-auth";
import {normalizeHostname} from "@/lib/host-boundary";
import {BO_STAGING_RETURN_HOST} from "@/lib/bo-staging-return-to";
import {SalesLeadPipelineView} from "./SalesLeadPipelineView";
import {NativeLeadEntry} from "./NativeLeadEntry";
import {parseNativeLeadQuery,canonicalLeadStageQuery} from "./native-lead-query";
import {resolveLegacyLeadIntent} from "./legacy-lead-intent-resolution";
export const dynamic="force-dynamic";
const path="/bo/sales/leads";
export default async function SalesLeadPipelinePage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const incoming=new Headers(await headers());
 const {env}=await getCloudflareContext({async:true}) as unknown as {env:BoShellGateEnv&{APP_ENV?:string}};
 const host=normalizeHostname(incoming.get("host")??"");
 const actor=await authorizeBoShell(incoming,env);
 if(env.APP_ENV === "staging"||host===BO_STAGING_RETURN_HOST){
  if(env.APP_ENV!=="staging"||host!==BO_STAGING_RETURN_HOST)notFound();
  if(!actor.permissionKeys.includes("acquisition.lead.manage"))forbidden();
  if(incoming.get("cookie")?.split(";").some(v=>v.trim().startsWith("pino_support_session=")))forbidden();
  const credential=await teamCredentialFromHeaders(incoming,env,"BO").catch(error=>{if(error instanceof TeamAuthError)forbidden();throw error;});
  if(credential.kind!=="password")forbidden();
  const raw=await searchParams;
  const normalized=canonicalLeadStageQuery(raw);
  if(normalized===null)notFound();
  const query=parseNativeLeadQuery(new URLSearchParams(normalized));
  if(!query)notFound();
  if(query.kind==="legacy-intent"){
   const result=await resolveLegacyLeadIntent(env.PINO_BO_CORE,credential,actor.userId,query.leadIntent);
   if(result.status===200)redirect(result.href);
   if(result.status===401||result.status===403)forbidden();
   if(result.status===400||result.status===404)notFound();
   return <main><p role="alert">Không thể tải lượt tiếp nhận. Vui lòng thử lại.</p></main>;
  }
  if(!parseNativeLeadQuery(raw))redirect(path+(normalized?"?"+normalized:""));
  return <NativeLeadEntry actorId={actor.userId}/>;
 }
 if(!actor.permissionKeys.includes("acquisition.lead.manage"))forbidden();
 return <SalesLeadPipelineView />;
}
