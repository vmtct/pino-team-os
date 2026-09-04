import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleCenterNetworkIngress, type CenterNetworkIngressEnv } from "@/lib/center-network-ingress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true }) as unknown as { env: CenterNetworkIngressEnv };
  return handleCenterNetworkIngress(request, env);
}
