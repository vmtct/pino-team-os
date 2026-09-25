import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleStaffLogout, type StaffLogoutEnv } from "@/lib/staff-logout-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const { env } = await getCloudflareContext({ async: true }) as unknown as { env: StaffLogoutEnv };
    return handleStaffLogout(request, env);
  } catch {
    return handleStaffLogout(request);
  }
}
