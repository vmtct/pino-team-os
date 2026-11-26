import { headers } from "next/headers";
import { forbidden,notFound } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { boSkeletonEnabled } from "@/lib/bo-skeleton";
import { authorizeBoShell,type BoShellGateEnv } from "@/lib/bo-shell-gate";
import { ParentStagingEntry } from "./ParentStagingEntry";
import { canonicalParentRoute } from "./parent-route";
/** PAP-2389 / SCH-PARENTS-GUARDIANS — exact staging M1-B, existing authenticated BO shell. */
export const dynamic="force-dynamic";
export default async function ParentsPage({searchParams}: {searchParams: Promise<Record<string,string|string[]|undefined>>}) {
  const incoming=await headers(),host=incoming.get("host")??"";
  const {env}=await getCloudflareContext({async:true}) as unknown as {env:BoShellGateEnv & {APP_ENV?:string;BO_UI_ONLY?:string}};
  if(host!=="bo.staging.pinohouse.art"||env.APP_ENV!=="staging"||!boSkeletonEnabled(env,host))notFound();
  const query=await searchParams;
  if(!canonicalParentRoute(query))notFound();
  const actor=await authorizeBoShell(new Headers(incoming),env);
  if(!actor.permissionKeys.includes("identity.parent_directory.view"))forbidden();
  return <ParentStagingEntry actorId={actor.userId} actorEmail={actor.email} canCreate={actor.permissionKeys.includes("identity.parent.create")} canEdit={actor.permissionKeys.includes("identity.parent.edit")}/>;
}
