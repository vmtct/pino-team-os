import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { StaffPasswordEnv } from "@/lib/staff-password-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const token = cookie(request, "pino_staff_password_session");
  if (token) {
    try {
      const { env } = await getCloudflareContext({ async: true }) as unknown as { env: StaffPasswordEnv };
      await env.PINO_STAFF_PASSWORD_CORE.logout(token);
    } catch { /* cookie is cleared even when core session is already invalid */ }
  }
  const headers = new Headers({ "cache-control": "no-store" });
  headers.append("set-cookie", "pino_staff_password_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0");
  return Response.json({ data: { revoked: true } }, { status: 200, headers });
}

function cookie(request: Request, name: string): string {
  return request.headers.get("cookie")?.split(";").map(v => v.trim()).find(v => v.startsWith(`${name}=`))?.slice(name.length + 1) ?? "";
}
