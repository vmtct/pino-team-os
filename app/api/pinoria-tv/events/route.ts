import { getCloudflareContext } from "@opennextjs/cloudflare";
import { WorkforceAuthError } from "@/lib/workforce-auth";
import { authenticatePinoriaTvRequest, type PinoriaTvAuthEnv } from "@/lib/pinoria-tv-auth";
import type { PinoriaTvCoreBinding } from "@/lib/staff-pin-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Env = PinoriaTvAuthEnv & { PINO_PINORIA_TV_CORE: PinoriaTvCoreBinding };

export async function GET(request: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true }) as unknown as { env: Env };
    await authenticatePinoriaTvRequest(request, env);
    const query = new URL(request.url).searchParams;
    const centerId = query.get("centerId") ?? "";
    const after = Number(query.get("after") ?? 0);
    return Response.json(
      { data: await env.PINO_PINORIA_TV_CORE.events(centerId, after, 100) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof WorkforceAuthError) return Response.json({ error: { message: error.message } }, { status: error.status });
    return Response.json({ error: { message: "Không tải được sự kiện Pinoria" } }, { status: 500 });
  }
}
