import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleHoPathRead, type HoPathReadEnv } from "@/lib/ho-path-read-facade";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true }) as unknown as { env: HoPathReadEnv };
  return handleHoPathRead(request, env);
}
