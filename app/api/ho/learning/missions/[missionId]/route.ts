import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleHoMissionWrite, type HoMissionWriteEnv } from "@/lib/ho-mission-write-facade";
export const runtime = "nodejs";
type Context = { params: Promise<{ missionId: string }> };
export async function PUT(request: Request, context: Context): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true }) as unknown as { env: HoMissionWriteEnv };
  const { missionId } = await context.params;
  return handleHoMissionWrite(request, env, missionId);
}
