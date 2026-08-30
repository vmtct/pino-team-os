import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleStaffPinStatus, type StaffPinAccessEnv } from "@/lib/staff-pin-access-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { env } = await getCloudflareContext({ async: true }) as unknown as { env: StaffPinAccessEnv };
  return handleStaffPinStatus(request, env);
}
