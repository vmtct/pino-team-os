// PAP-1407 / PAP-220 — Founder HO-only Center Staff link read/toggle BFF.
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleHoStaffCenterLinks, type HoStaffCenterLinksEnv } from "@/lib/ho-staff-center-links-facade";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true }) as unknown as { env: HoStaffCenterLinksEnv };
  return handleHoStaffCenterLinks(request, env);
}

export const GET = handle;
export const POST = handle;
