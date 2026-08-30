import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { PinoriaTvCoreBinding, StaffPinCoreBinding } from "@/lib/staff-pin-core";
import { validateStaffSession } from "@/lib/staff-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Env = {
  PINO_PINORIA_TV_CORE: PinoriaTvCoreBinding;
  PINO_STAFF_PIN_CORE: StaffPinCoreBinding;
};

export async function GET(request: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true }) as unknown as { env: Env };
    const session = await validateStaffSession(request, env.PINO_STAFF_PIN_CORE);
    if (session.error) return session.error;
    const centerId = new URL(request.url).searchParams.get("centerId") ?? "";
    return Response.json(
      { data: await env.PINO_PINORIA_TV_CORE.snapshot(centerId) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return Response.json({ error: { message: "Không tải được Pinoria House" } }, { status: 500 });
  }
}
