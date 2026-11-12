/** PAP-1646 / Epic PAP-650 PNR-TV — scoped Staging F1/F2 logical Viewer.
 * Staff: only if existing Core Workforce authenticates an unambiguous Center
 * and Core publishes the effective Policy under its own authorization.
 * HO Founder/multi-Center need a trusted selected-Center source and a separate
 * serialized host-boundary admission. Deny these cases rather than guess.
 * Missing PAP-9 / PAP-1921 F3 permission means Core denial (NO fixture bypass).
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { PolicyViewerFrame } from "@/app/tv/PolicyViewerFrame";
import {
  readStaffPublishedViewer,
  type StaffPolicyViewerEnv,
} from "@/lib/pinoria-tv-viewer-v1-staff";
import { isStableTvPolicyRef } from "@/lib/pinoria-tv-viewer-link";
import { TOS_STAGING_HOSTNAME } from "@/lib/host-boundary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = { params: Promise<{ policyRef: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function LogicalTvPolicyViewer({ params, searchParams }: Params) {
  const { policyRef } = await params;
  const query = await searchParams;
  const incoming = await headers();
  const host = incoming.get("host")?.trim().toLowerCase() ?? "";
  if (host !== TOS_STAGING_HOSTNAME || Object.keys(query).length > 0 ||
    !isStableTvPolicyRef(policyRef)) notFound();

  // Only a host-validated server request, never client-provided Center/header.
  const request = new Request("https://" + TOS_STAGING_HOSTNAME +
    "/tv/p/" + policyRef, {
    method: "GET",
    headers: {
      host: TOS_STAGING_HOSTNAME,
      cookie: incoming.get("cookie") ?? "",
    },
  });
  let result;
  try {
    const { env } = await getCloudflareContext({ async: true }) as unknown as {
      env: StaffPolicyViewerEnv,
    };
    result = await readStaffPublishedViewer(request, env, policyRef);
  } catch {
    // Never fall back to a synthetic Policy or device entitlement.
    notFound();
  }

  if (result.kind === "blocked") {
    if (result.status === 401) {
      // Login is on this same Staging host; do not allow an external return URL.
      redirect("/staff-login?returnTo=" + encodeURIComponent("/tv/p/" + policyRef));
    }
    // 403/404/503: HTTP 404, not a misleading authenticated 200.
    notFound();
  }

  const policy = result.policy;
  // View-only published-Policy status, not a physical Device, runtime
  // presence, active student session or simulated event playback.
  return (
    <PolicyViewerFrame aspect="16:9" label="Pinoria TV Ambient Welcome">
      <article data-pnr-tv-published-policy="authorized" aria-label="Chính sách TV đang áp dụng">
        <h1>Pinoria TV</h1>
        <p>Ambient Welcome · Chính sách đang áp dụng</p>
        <p>Phiên bản {policy.appliedRevision}</p>
        <p>{policy.configuration.quietMode ? "Chế độ yên tĩnh" : "Chỉ xem chính sách đã xuất bản"}</p>
      </article>
    </PolicyViewerFrame>
  );
}
