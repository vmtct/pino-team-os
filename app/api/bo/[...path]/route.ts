import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleBoOperationalReadRequest, type BoReadEnv } from "@/lib/bo-read-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true }) as unknown as { env: BoReadEnv };
  const { path } = await context.params;
  return handleBoOperationalReadRequest(request, env, path.join("/"));
}
