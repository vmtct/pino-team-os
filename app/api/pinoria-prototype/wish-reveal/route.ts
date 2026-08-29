import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";
import type { PinoriaWishCoreEnv } from "../../../../lib/pinoria-wish-core";

export const runtime = "nodejs";

const SURFACE_ID = "RECEPTION_TV";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function coreEnv() {
  const context = await getCloudflareContext({ async: true }) as unknown as { env: PinoriaWishCoreEnv };
  const centerId = context.env.PINORIA_CENTER_ID?.trim();
  if (!centerId || !UUID.test(centerId)) throw new Error("PINORIA_CENTER_ID_UNAVAILABLE");
  return { env: context.env, centerId };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    if (body.surfaceId !== undefined && body.surfaceId !== SURFACE_ID) return json({ ok: false, error: "INVALID_SURFACE" }, 400);
    const { env, centerId } = await coreEnv();
    if (body.op === "claim") {
      const claimed = await env.PINO_TV_CORE.claimWishReveal(centerId);
      return json({
        reveal: claimed ? { projection: claimed.reveal, claimedAt: claimed.claimedAt } : null,
      });
    }
    if (body.op === "complete") {
      const revealId = typeof body.revealId === "string" ? body.revealId : "";
      if (!UUID.test(revealId)) return json({ ok: false, error: "INVALID_REVEAL" }, 400);
      const completed = await env.PINO_TV_CORE.completeWishReveal(centerId, revealId);
      return json({ ok: true, ...completed });
    }
    return json({ ok: false, error: "UNSUPPORTED_OPERATION" }, 400);
  } catch (error) {
    console.error("Pinoria Wish reveal bridge failure", error instanceof Error ? error.message : "unknown");
    return json({ ok: false, error: "WISH_REVEAL_CORE_UNAVAILABLE" }, 503);
  }
}