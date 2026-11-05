import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleHoRoleEdit, type HoRoleEditEnv } from "@/lib/ho-role-edit-facade";

export const runtime = "nodejs";
type Context = { params: Promise<{ roleId: string }> };
export async function POST(request: Request, context: Context): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true }) as unknown as { env: HoRoleEditEnv };
  const { roleId } = await context.params;
  return handleHoRoleEdit(request, env, roleId);
}
