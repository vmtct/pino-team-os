import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ReceptionTv } from "@/app/pinoria-tv/reception-tv";
import { readStaffPublishedViewer, type StaffPolicyViewerEnv } from "@/lib/pinoria-tv-viewer-v1-staff";

export const dynamic = "force-dynamic";

export default async function HouseAmbientPage({ params }: { params: Promise<{ policyRef: string }> }) {
  const { policyRef } = await params;
  if (!policyRef.startsWith("tvp2-house-ambient-")) notFound();
  const incoming = new Headers(await headers());
  const host = incoming.get("host");
  if (!host) notFound();
  const { env } = await getCloudflareContext({ async: true }) as unknown as { env: StaffPolicyViewerEnv };
  const request = new Request("https://" + host + "/tv/p/" + encodeURIComponent(policyRef), { headers: incoming });
  const result = await readStaffPublishedViewer(request, env, policyRef);
  if (result.kind === "blocked") notFound();
  return <ReceptionTv key={result.policy.policyRef} fixedCenterId={result.policy.selectedCenterId}
    staffPolicyRef={result.policy.policyRef} staffPolicy={result.policy.configuration} />;
}
