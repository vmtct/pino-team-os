import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleHoStaffRole, type HoStaffRoleEnv } from "@/lib/ho-staff-role-facade";

export const runtime = "nodejs";
type Context = { params: Promise<{ staffId: string }> };
export async function POST(request: Request, context: Context): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true }) as unknown as { env: HoStaffRoleEnv };
  const { staffId } = await context.params;
  return handleHoStaffRole(request, env, staffId);
}
