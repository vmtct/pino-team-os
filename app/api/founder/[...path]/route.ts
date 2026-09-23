import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleFounderFacadeRequest, type FounderFacadeEnv } from "@/lib/founder-facade-handler";

export const runtime = "nodejs";
type Context = { params: Promise<{ path: string[] }> };

async function handle(request: Request, context: Context): Promise<Response> {
  const { env } = await getCloudflareContext({ async: true }) as unknown as { env: FounderFacadeEnv };
  const { path } = await context.params;
  return handleFounderFacadeRequest(request, env, path);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
