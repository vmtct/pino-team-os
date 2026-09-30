import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleResetPassword, type StaffPasswordRecoveryEnv } from "@/lib/staff-password-recovery-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true }) as unknown as { env: StaffPasswordRecoveryEnv };
  return handleResetPassword(request, env);
}
