import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";
import { forbidden } from "next/navigation";
import { authorizeBoShell, type BoShellGateEnv } from "@/lib/bo-shell-gate";
import { SalesLeadPipelineView } from "./SalesLeadPipelineView";

export const dynamic = "force-dynamic";

export default async function SalesLeadPipelinePage({ searchParams }: { searchParams: Promise<{ m1Preview?: string }> }) {
  const incoming = await headers();
  const { env } = await getCloudflareContext({ async: true }) as unknown as { env: BoShellGateEnv };
  const actor = await authorizeBoShell(new Headers(incoming), env);
  // PAP-2286: authenticated BO users can review fixture-only M1 on staging;
  // live Leads data and actions retain the acquisition.lead.manage permission.
  const previewRequested = (await searchParams).m1Preview === "1";
  const previewAllowed = (env as BoShellGateEnv & { APP_ENV?: string }).APP_ENV === "staging" && previewRequested;
  if (!previewAllowed && !actor.permissionKeys.includes("acquisition.lead.manage")) forbidden();
  return <SalesLeadPipelineView allowM1Preview={previewAllowed} forceM1Preview={previewAllowed} />;
}
