import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleHoShiftTemplatesRead, type HoShiftTemplatesEnv } from "@/lib/ho-shift-templates-read-facade";
export const runtime = "nodejs";
export async function GET(request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true }) as unknown as { env: HoShiftTemplatesEnv };
  return handleHoShiftTemplatesRead(request, env);
}
