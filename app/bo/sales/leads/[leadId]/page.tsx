import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";
import { forbidden } from "next/navigation";
import { authorizeBoShell, type BoShellGateEnv } from "@/lib/bo-shell-gate";
import { LeadDetailPage } from "../LeadDetailPage";

export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ leadId: string }> }) {
  const incoming = await headers();
  const { env } = await getCloudflareContext({ async: true }) as unknown as { env: BoShellGateEnv };
  const actor = await authorizeBoShell(new Headers(incoming), env);
  if (!actor.permissionKeys.includes("acquisition.lead.manage")) forbidden();
  const { leadId } = await params;
  return <LeadDetailPage leadId={leadId} />;
}
