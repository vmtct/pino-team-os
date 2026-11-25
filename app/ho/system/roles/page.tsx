import { HoRolesTdd } from "./HoRolesTdd";
import { RoleM1Preview } from "./RoleM1Preview";
import { roleReviewRoute } from "./role-m1-preview";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";
import { forbidden } from "next/navigation";
import { authorizeHoShell, type HoEnv } from "@/lib/ho-auth";
import { normalizeHostname } from "@/lib/host-boundary";
import { decideM1Preview } from "@/lib/m1-preview/admission.server";

export const dynamic = "force-dynamic";
// PAP-2192 / PLT-ACCESS: canonical Staging list review, remove at M4.
export default async function Page({searchParams}:{searchParams:Promise<{m1Preview?:string|string[];record?:string|string[]}>}) {
  const query=await searchParams;
  const incoming = new Headers(await headers());
  const {env}=await getCloudflareContext({async:true}) as unknown as {env:HoEnv};
  const route=roleReviewRoute(query);
  if(route==="invalid")forbidden();
  if(env.APP_ENV!=="staging"||normalizeHostname(incoming.get("host")||"")!=="ho.staging.pinohouse.art"){
    if(query.m1Preview!==undefined||route==="preview"&&query.record!==undefined)forbidden();
    return <HoRolesTdd/>;
  }
  // Canonical HO layout/authentication is still required for both providers.
  const actor=await authorizeHoShell(incoming,env);
  if(route==="live")return <HoRolesTdd nativeLifecycle/>;
  const allowed=decideM1Preview({environment:env.APP_ENV,hostname:normalizeHostname(incoming.get("host")||""),surface:"HO",requested:true,featureEnabled:true,authenticated:actor.entitled,surfaceAuthorized:true,scopeAuthorized:true,featureReviewAuthorized:actor.permissionKeys.includes("access.role.view")&&actor.permissionKeys.includes("access.role.create")});
  if(!allowed.allowed){
    // Preserve preexisting live list for a viewer without the review capability.
    if(query.record===undefined&&query.m1Preview===undefined)return <HoRolesTdd/>;
    forbidden();
  }
  return <RoleM1Preview key={actor.userId} scopeKey={actor.userId} permissionKeys={actor.permissionKeys.filter(key=>key==="access.role.view"||key==="access.role.create"||key==="access.role.edit")}/>;
}
