import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleStaffPinLogin, type StaffPinLoginEnv } from "@/lib/staff-pin-login-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true }) as unknown as { env: StaffPinLoginEnv };
  return handleStaffPinLogin(request, env);
}
