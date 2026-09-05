import { getCloudflareContext } from "@opennextjs/cloudflare";
import { authenticatePinoriaTvRequest, PinoriaTvAuthError, type PinoriaTvAuthEnv } from "@/lib/pinoria-tv-auth";
import type { PinoriaTvCoreBinding } from "@/lib/staff-pin-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Env = PinoriaTvAuthEnv & { PINO_PINORIA_TV_CORE: PinoriaTvCoreBinding };

export async function GET(request: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true }) as unknown as { env: Env };
    await authenticatePinoriaTvRequest(request, env);
    const centerId = new URL(request.url).searchParams.get("centerId") ?? "";
    return Response.json(
      { data: await env.PINO_PINORIA_TV_CORE.snapshot(centerId) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof PinoriaTvAuthError) return Response.json({ error: { message: error.message } }, { status: error.status });
    return Response.json({ error: { message: "Không tải được Pinoria House" } }, { status: 500 });
  }
}
