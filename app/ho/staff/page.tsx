import { StaffTdd } from "./StaffTdd";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";
import { forbidden } from "next/navigation";
import { authorizeHoShell, type HoEnv } from "@/lib/ho-auth";
import { normalizeHostname } from "@/lib/host-boundary";
import { decideM1Preview } from "@/lib/m1-preview/admission.server";
export const dynamic = "force-dynamic";
// PAP-2353 · temporary, explicit server opt-in for this feature only; remove at M4.
const STAFF_M1_REVIEW_ENABLED = true;
export default async function HoStaffPage({ searchParams }: { searchParams: Promise<{ m1Preview?: string }> }) {
  if ((await searchParams).m1Preview !== "1") return <StaffTdd />;
  const incoming = new Headers(await headers());
  const { env } = await getCloudflareContext({ async: true }) as unknown as { env: HoEnv };
  // Existing HO layout and canonical Founder proof remain mandatory; no client claims.
  const actor = await authorizeHoShell(incoming, env);
  const admission = decideM1Preview({ environment: env.APP_ENV, hostname: normalizeHostname(incoming.get("host") || ""), surface: "HO",
    requested: true, featureEnabled: STAFF_M1_REVIEW_ENABLED, authenticated: actor.entitled, surfaceAuthorized: true,
    featureReviewAuthorized: actor.permissionKeys.includes("team.bo.access"), scopeAuthorized: true });
  if (!admission.allowed) forbidden();
  const { StaffManualPreview } = await import("./StaffManualPreview");
  return <StaffManualPreview key={actor.userId} principalId={actor.userId} />;
}
