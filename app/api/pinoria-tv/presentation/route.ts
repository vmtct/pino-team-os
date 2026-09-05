import { getCloudflareContext } from "@opennextjs/cloudflare";
import { authenticatePinoriaTvRequest, PinoriaTvAuthError, type PinoriaTvAuthEnv } from "@/lib/pinoria-tv-auth";
import type { PinoriaTvCoreBinding } from "@/lib/staff-pin-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Env = PinoriaTvAuthEnv & { PINO_PINORIA_TV_CORE: PinoriaTvCoreBinding };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true }) as unknown as { env: Env };
    await authenticatePinoriaTvRequest(request, env);
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const centerId = typeof body.centerId === "string" ? body.centerId.trim() : "";
    if (!UUID.test(centerId)) return json({ ok: false, error: "INVALID_CENTER" }, 400);
    if (body.op === "claim") {
      const presentation = await env.PINO_PINORIA_TV_CORE.claimPresentation(centerId);
      return json({ presentation });
    }

    if (body.op === "complete") {
      const presentationId = typeof body.presentationId === "string" ? body.presentationId.trim() : "";
      if (!UUID.test(presentationId)) return json({ ok: false, error: "INVALID_PRESENTATION" }, 400);
      const completed = await env.PINO_PINORIA_TV_CORE.completePresentation(centerId, presentationId);
      return json({ ok: true, ...completed });
    }

    return json({ ok: false, error: "UNSUPPORTED_OPERATION" }, 400);
  } catch (error) {
    if (error instanceof PinoriaTvAuthError) return json({ error: { message: error.message } }, error.status);
    console.error("Pinoria presentation bridge failure", error instanceof Error ? error.message : "unknown");
    return json({ ok: false, error: "PINORIA_PRESENTATION_CORE_UNAVAILABLE" }, 503);
  }
}
