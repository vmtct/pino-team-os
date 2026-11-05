import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleHoStaffPasswordReset, type HoStaffPasswordResetEnv } from "@/lib/ho-staff-password-reset-facade";

export const runtime = "nodejs";
type Context = { params: Promise<{ staffId: string }> };
export async function POST(request: Request, context: Context): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true }) as unknown as { env: HoStaffPasswordResetEnv };
  const { staffId } = await context.params;
  return handleHoStaffPasswordReset(request, env, staffId);
}
