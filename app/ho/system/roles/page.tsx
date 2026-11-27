import { HoRolesTdd } from "./HoRolesTdd";
import { parseNativeRoleQuery } from "./native-role-query";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";
import { forbidden, notFound } from "next/navigation";
import { authorizeHoShell, type HoEnv } from "@/lib/ho-auth";
import { HO_STAGING_HOSTNAME, normalizeHostname } from "@/lib/host-boundary";

export const dynamic = "force-dynamic";
// PAP-2373 / PLT-ACCESS: canonical native Roles, no runtime fixture fallback.
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const params = new URLSearchParams();
  for(const [key,value] of Object.entries(await searchParams)){
    if(typeof value==="string")params.append(key,value);
    else if(Array.isArray(value))for(const item of value)params.append(key,item);
  }
  if(!parseNativeRoleQuery(params))notFound();
  const incoming = new Headers(await headers());
  const {env}=await getCloudflareContext({async:true}) as unknown as {env:HoEnv};
  if(env.APP_ENV!=="staging"||normalizeHostname(incoming.get("host")||"")!==HO_STAGING_HOSTNAME)notFound();
  const actor=await authorizeHoShell(incoming,env);
  if(!actor.entitled||!actor.permissionKeys.includes("access.role.view"))forbidden();
  return <HoRolesTdd nativeLifecycle/>;
}
