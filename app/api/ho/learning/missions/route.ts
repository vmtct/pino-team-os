import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleHoMissionWrite, type HoMissionWriteEnv } from "@/lib/ho-mission-write-facade";
export const runtime = "nodejs";
export async function POST(request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true }) as unknown as { env: HoMissionWriteEnv };
  return handleHoMissionWrite(request, env);
}
