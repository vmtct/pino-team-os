import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleBoOperationalReadRequest, type BoReadEnv } from "@/lib/bo-read-handler";
import { handleBoWriteRequest, type BoWriteEnv } from "@/lib/bo-write-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BoEnv = BoReadEnv & BoWriteEnv;
type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true }) as unknown as { env: BoEnv };
  const { path } = await context.params;
  return handleBoOperationalReadRequest(request, env, path.join("/"));
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true }) as unknown as { env: BoEnv };
  const { path } = await context.params;
  return handleBoWriteRequest(request, env, path.join("/"));
}