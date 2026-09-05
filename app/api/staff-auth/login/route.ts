import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { StaffPasswordEnv } from "@/lib/staff-password-core";
import { loginStaffWithTransition } from "@/lib/staff-password-transition";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const { env } = await getCloudflareContext({ async: true }) as unknown as { env: StaffPasswordEnv };
    const body = await request.json() as { email?: string; password?: string };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!email || !password) return Response.json({ error: { message: "Vui lòng nhập email và mật khẩu." } }, { status: 400 });
    const result = await loginStaffWithTransition(request, env, { email, password });
    const headers = new Headers({ "cache-control": "no-store" });
    headers.append("set-cookie", `pino_staff_password_session=${result.token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`);
    return Response.json({ data: { userId: result.userId, staffMemberId: result.staffMemberId, email: result.email, expiresAt: result.expiresAt } }, { status: 200, headers });
  } catch {
    return Response.json({ error: { message: "Email hoặc mật khẩu không đúng." } }, { status: 401, headers: { "cache-control": "no-store" } });
  }
}
