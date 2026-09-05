import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { StaffPasswordEnv } from "@/lib/staff-password-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const token = cookie(request, "pino_staff_password_session");
  if (!token) return Response.json({ data: { authenticated: false } }, { status: 200, headers: { "cache-control": "no-store" } });
  try {
    const { env } = await getCloudflareContext({ async: true }) as unknown as { env: StaffPasswordEnv };
    const session = await env.PINO_STAFF_PASSWORD_CORE.status(token);
    return Response.json({ data: { authenticated: true, ...session } }, { status: 200, headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ data: { authenticated: false } }, { status: 200, headers: { "cache-control": "no-store" } });
  }
}

function cookie(request: Request, name: string): string {
  return request.headers.get("cookie")?.split(";").map(v => v.trim()).find(v => v.startsWith(`${name}=`))?.slice(name.length + 1) ?? "";
}
