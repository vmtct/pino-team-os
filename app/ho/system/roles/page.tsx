import { HoRolesTdd } from "./HoRolesTdd";
import { RoleM1Preview } from "./RoleM1Preview";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";
import { forbidden } from "next/navigation";
import { authorizeHoShell, type HoEnv } from "@/lib/ho-auth";
import { normalizeHostname } from "@/lib/host-boundary";
import { decideM1Preview } from "@/lib/m1-preview/admission.server";

// PAP-2192 / PLT-ACCESS: discoverable isolated review, never a live create command.
export default async function Page({searchParams}:{searchParams:Promise<{m1Preview?:string}>}) {
  const requested=(await searchParams).m1Preview==="1";
  const incoming = new Headers(await headers());
  const {env}=await getCloudflareContext({async:true}) as unknown as {env:HoEnv};
  if(env.APP_ENV!=="staging"||normalizeHostname(incoming.get("host")||"")!=="ho.staging.pinohouse.art"){
    if(requested)forbidden();
    return <HoRolesTdd/>;
  }
  const actor=await authorizeHoShell(incoming,env);
  const allowed=decideM1Preview({environment:env.APP_ENV,hostname:normalizeHostname(incoming.get("host")||""),surface:"HO",requested:true,featureEnabled:true,authenticated:actor.entitled,surfaceAuthorized:true,scopeAuthorized:true,featureReviewAuthorized:actor.permissionKeys.includes("access.role.view")&&actor.permissionKeys.includes("access.role.create")});
  if(!requested)return <HoRolesTdd previewAvailable={allowed.allowed}/>;
  if(!allowed.allowed)forbidden();
  return <RoleM1Preview key={actor.userId} scopeKey={actor.userId} permissionKeys={actor.permissionKeys.filter(key=>key==="access.role.view"||key==="access.role.create")}/>;
}
