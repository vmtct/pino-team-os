import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { StaffPinCoreBinding } from "@/lib/staff-pin-core";
import { readStaffSessionToken } from "@/lib/staff-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Env = { PINO_STAFF_PIN_CORE: StaffPinCoreBinding };

export async function POST(request: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true }) as unknown as { env: Env };
    const token = readStaffSessionToken(request);
    if (token) await env.PINO_STAFF_PIN_CORE.logout(token);
    return new Response(null, {
      status: 204,
      headers: {
        "set-cookie": "pino_staff_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0",
      },
    });
  } catch {
    return Response.json({ error: { message: "Không thể đăng xuất" } }, { status: 500 });
  }
}
