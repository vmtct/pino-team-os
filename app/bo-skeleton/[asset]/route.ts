import { getCloudflareContext } from "@opennextjs/cloudflare";
import { serveBoSkeleton, type BoSkeletonEnv } from "@/lib/bo-skeleton";

export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ asset: string }> }) {
  const { env } = await getCloudflareContext({ async: true }) as unknown as { env: BoSkeletonEnv };
  return serveBoSkeleton(request, env, (await context.params).asset);
}
