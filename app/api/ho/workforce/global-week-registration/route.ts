import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleHoGlobalWeekLock, type HoGlobalWeekEnv } from "@/lib/ho-global-week-lock-facade";
export const runtime = "nodejs";
export async function GET(request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true }) as unknown as { env: HoGlobalWeekEnv };
  return handleHoGlobalWeekLock(request, env);
}
export async function POST(request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true }) as unknown as { env: HoGlobalWeekEnv };
  return handleHoGlobalWeekLock(request, env);
}
