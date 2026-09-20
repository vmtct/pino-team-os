import { getCloudflareContext } from "@opennextjs/cloudflare";
import { authenticatePinoriaTvRequest, PinoriaTvAuthError, type PinoriaTvAuthEnv } from "@/lib/pinoria-tv-auth";
import type { PinoriaTvCoreBinding } from "@/lib/staff-pin-core";
import { mergePresenceWardSessions } from "@/app/pinoria-tv/presence-contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Env = PinoriaTvAuthEnv & { PINO_PINORIA_TV_CORE: PinoriaTvCoreBinding };

export async function GET(request: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true }) as unknown as { env: Env };
    await authenticatePinoriaTvRequest(request, env);
    const centerId = new URL(request.url).searchParams.get("centerId") ?? "";
    const [presence, learnerHouse] = await Promise.all([
      env.PINO_PINORIA_TV_CORE.presenceSnapshot(centerId),
      env.PINO_PINORIA_TV_CORE.snapshot(centerId),
    ]);
    return Response.json(
      { data: mergePresenceWardSessions(presence, learnerHouse) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof PinoriaTvAuthError) return Response.json({ error: { message: error.message } }, { status: error.status });
    return Response.json({ error: { message: "Không tải được Pinoria House" } }, { status: 500 });
  }
}
