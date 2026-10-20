import { getCloudflareContext } from "@opennextjs/cloudflare";
import { authenticatePinoriaTvRequest, PinoriaTvAuthError, type PinoriaTvAuthEnv } from "@/lib/pinoria-tv-auth";
import type { PinoriaTvCoreBinding } from "@/lib/pinoria-tv-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Env = PinoriaTvAuthEnv & { PINO_PINORIA_TV_CORE: PinoriaTvCoreBinding };

/** Private to a device-authenticated PINORIA_HOUSE runtime. No edit authority. */
export async function GET(request: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true }) as unknown as { env: Env };
    await authenticatePinoriaTvRequest(request, env);
    const centerId = new URL(request.url).searchParams.get("centerId")?.trim() ?? "";
    if (!/^[0-9a-f-]{36}$/i.test(centerId)) {
      return Response.json({error:{message:"Valid Center required"}},{status:400,headers:{"cache-control":"no-store"}});
    }
    // Core and Team may be deployed independently. During an upgrade,
    // absence of this read-only binding keeps the validated saved graph.
    if (!env.PINO_PINORIA_TV_CORE?.spatialConfig) return Response.json({ data:null },{headers:{"cache-control":"no-store"}});
    const data = await env.PINO_PINORIA_TV_CORE.spatialConfig(centerId);
    return Response.json({ data },{headers:{"cache-control":"no-store"}});
  } catch (error) {
    if (error instanceof PinoriaTvAuthError) return Response.json({error:{message:error.message}},{status:error.status});
    return Response.json({error:{message:"House spatial configuration unavailable"}},{status:503});
  }
}
