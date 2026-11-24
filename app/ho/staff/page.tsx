import { StaffTdd } from "./StaffTdd";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";
import { forbidden } from "next/navigation";
import { authorizeHoShell, type HoEnv } from "@/lib/ho-auth";
import { normalizeHostname } from "@/lib/host-boundary";
import { decideM1Preview } from "@/lib/m1-preview/admission.server";
export const dynamic = "force-dynamic";
// PAP-2353 · HO Manual Staff Creation: canonical staging M1 review; remove at M4.
const STAFF_M1_REVIEW_ENABLED = true;
export default async function HoStaffPage({ searchParams }: { searchParams: Promise<{ m1Preview?: string | string[]; record?: string | string[] }> }) {
  const query = await searchParams;
  const incoming = new Headers(await headers());
  const { env } = await getCloudflareContext({ async: true }) as unknown as { env: HoEnv };
  const staging = env.APP_ENV === "staging" && normalizeHostname(incoming.get("host") || "") === "ho.staging.pinohouse.art";
  if (query.m1Preview !== undefined && query.m1Preview !== "1") forbidden();
  if (!staging || !STAFF_M1_REVIEW_ENABLED) {
    if (query.m1Preview !== undefined) forbidden();
    return <StaffTdd />;
  }
  // Preserve real Staff detail bookmarks in the existing live provider; never mix them with the synthetic review.
  if (typeof query.record === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query.record)) {
    if (query.m1Preview !== undefined) forbidden();
    return <StaffTdd />;
  }
  if (query.record !== undefined && (typeof query.record !== "string" || !/^STAFF-MOCK-[0-9]{3,}$/.test(query.record))) forbidden();
  // Existing HO layout and canonical Founder proof remain mandatory; no client claims.
  const actor = await authorizeHoShell(incoming, env);
  const admission = decideM1Preview({ environment: env.APP_ENV, hostname: normalizeHostname(incoming.get("host") || ""), surface: "HO",
    requested: true, featureEnabled: STAFF_M1_REVIEW_ENABLED, authenticated: actor.entitled, surfaceAuthorized: true,
    featureReviewAuthorized: actor.permissionKeys.includes("team.bo.access"), scopeAuthorized: true });
  if (!admission.allowed) forbidden();
  const { StaffManualPreview } = await import("./StaffManualPreview");
  return <StaffManualPreview key={actor.userId} principalId={actor.userId} />;
}
