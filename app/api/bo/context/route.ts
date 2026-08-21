import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleBoContextRequest, type BoContextEnv } from "@/lib/bo-context-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true }) as unknown as { env: BoContextEnv };
  return handleBoContextRequest(request, env);
}
