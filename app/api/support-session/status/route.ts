import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { StaffPasswordEnv } from "@/lib/staff-password-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const token = cookie(request, "pino_support_session");
  if (!token) return Response.json({ data: { active: false, invalid: false } }, { status: 200, headers: { "cache-control": "no-store" } });
  try {
    const { env } = await getCloudflareContext({ async: true }) as unknown as { env: StaffPasswordEnv };
    if (!env.PINO_STAFF_PASSWORD_CORE.supportStatus) throw new Error("support_unavailable");
    const session = await env.PINO_STAFF_PASSWORD_CORE.supportStatus(token);
    return Response.json({ data: { active: true, invalid: false, ...session } }, { status: 200, headers: { "cache-control": "no-store" } });
  } catch {
    const headers = new Headers({ "cache-control": "no-store" });
    headers.append("set-cookie", "pino_support_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0");
    return Response.json({ data: { active: false, invalid: true } }, { status: 200, headers });
  }
}

function cookie(request: Request, name: string): string {
  return request.headers.get("cookie")?.split(";").map(value => value.trim())
    .find(value => value.startsWith(`${name}=`))?.slice(name.length + 1) ?? "";
}
