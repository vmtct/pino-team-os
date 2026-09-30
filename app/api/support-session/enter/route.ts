import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { StaffPasswordEnv } from "@/lib/staff-password-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  let token = "";
  try {
    const form = await request.formData();
    token = typeof form.get("token") === "string" ? String(form.get("token")).trim() : "";
    if (!/^[A-Za-z0-9_-]{16,2048}\.[A-Za-z0-9_-]{32,256}$/.test(token)) throw new Error("invalid_token");

    const { env } = await getCloudflareContext({ async: true }) as unknown as { env: StaffPasswordEnv };
    if (!env.PINO_STAFF_PASSWORD_CORE.supportStatus) throw new Error("support_unavailable");
    const session = await env.PINO_STAFF_PASSWORD_CORE.supportStatus(token);
    const seconds = Math.max(1, Math.min(900, Math.floor((Date.parse(session.expiresAt) - Date.now()) / 1000)));
    if (!Number.isFinite(seconds) || seconds <= 0) throw new Error("expired");

    const headers = new Headers({
      location: "/",
      "cache-control": "no-store",
    });
    headers.append("set-cookie", `pino_support_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${seconds}`);
    headers.append("set-cookie", "pino_staff_password_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0");
    headers.append("set-cookie", "pino_staff_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0");
    return new Response(null, { status: 303, headers });
  } catch {
    const headers = new Headers({ location: "/staff-login?support=invalid", "cache-control": "no-store" });
    headers.append("set-cookie", "pino_support_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0");
    return new Response(null, { status: 303, headers });
  }
}
