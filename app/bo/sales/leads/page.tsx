import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { authorizeBoShell, type BoShellGateEnv } from "@/lib/bo-shell-gate";
import { safeBoStagingReturnTo } from "@/lib/bo-staging-return-to";
import { SalesLeadPipelineView } from "./SalesLeadPipelineView";
import { LeadHouseholdM1Preview } from "./LeadHouseholdM1Preview";

export const dynamic = "force-dynamic";

export default async function SalesLeadPipelinePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const incoming = await headers();
  const { env } = await getCloudflareContext({ async: true }) as unknown as { env: BoShellGateEnv };
  const actor = await authorizeBoShell(new Headers(incoming), env);
  // PAP-2286: one canonical staging FE Shell; no live acquisition commands.
  if ((env as BoShellGateEnv & { APP_ENV?: string }).APP_ENV === "staging") {
    const query = await searchParams;
    if (query.m1Preview !== undefined) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(query)) {
        if (Array.isArray(value)) for (const item of value) params.append(key, item);
        else if (value !== undefined) params.append(key, value);
      }
      redirect(safeBoStagingReturnTo("/bo/sales/leads?" + params.toString()) ?? "/bo/sales/leads");
    }
    return <LeadHouseholdM1Preview />;
  }
  // Existing live experience remains protected until M2-M4.
  if (!actor.permissionKeys.includes("acquisition.lead.manage")) forbidden();
  return <SalesLeadPipelineView />;
}
