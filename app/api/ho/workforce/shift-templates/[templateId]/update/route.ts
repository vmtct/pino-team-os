import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleHoShiftTemplateWrite } from "@/lib/ho-shift-templates-mutation-facade";
import type { HoShiftTemplatesEnv } from "@/lib/ho-shift-templates-read-facade";
export const runtime = "nodejs";
export async function POST(request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true }) as unknown as { env: HoShiftTemplatesEnv };
  return handleHoShiftTemplateWrite(request, env);
}
