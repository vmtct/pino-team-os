import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleHoMissionHistoryRead, type HoMissionWriteEnv } from "@/lib/ho-mission-write-facade";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ missionId: string }> };

export async function GET(request: Request, context: Context): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true }) as unknown as { env: HoMissionWriteEnv };
  const { missionId } = await context.params;
  return handleHoMissionHistoryRead(request, env, missionId);
}
