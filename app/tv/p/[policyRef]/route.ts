/** PAP-1646 / Epic PAP-650 PNR-TV — nonstreaming Staging Viewer ingress.
 * Avoid React streaming's false 200 on an expired session or denied Policy.
 * The preexisting TOS middleware still redirects fully anonymous users to login.
 * Viewer Core read independently checks Staff and Center; PAP-9 F3 not opened.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  blockedPolicyViewerHttp, handlePolicyViewerHttp,
} from "@/lib/pinoria-tv-viewer-v1-http";
import { readStaffPublishedViewer, type StaffPolicyViewerEnv } from "@/lib/pinoria-tv-viewer-v1-staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
type Context = { params: Promise<{ policyRef: string }> };

export async function GET(request: Request, { params }: Context): Promise<Response> {
  const { policyRef } = await params;
  try {
    const { env } = await getCloudflareContext({ async: true }) as unknown as {
      env: StaffPolicyViewerEnv,
    };
    if (policyRef.startsWith("tvp2-house-ambient-")) {
      const result = await readStaffPublishedViewer(request, env, policyRef);
      if (result.kind === "blocked") return blockedPolicyViewerHttp(result.status);
      return new Response(null, {
        status: 307,
        headers: { location: "/tv/house-ambient/" + result.policy.policyRef, "cache-control": "private, no-store" },
      });
    }
    return await handlePolicyViewerHttp(request, env, policyRef);
  } catch {
    // No synthetic demo/Policy content on binding/transport failure.
    return blockedPolicyViewerHttp(503);
  }
}
export function HEAD(): Response {
  // No HEAD shortcut for a protected GET and no auth/grant through metadata.
  return new Response(null, {
    status: 405,
    headers: { "cache-control": "private, no-store", allow: "GET",
      "x-content-type-options": "nosniff" },
  });
}
