import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { StaffPasswordEnv } from "@/lib/staff-password-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const token = cookie(request, "pino_staff_password_session");
  if (!token) return Response.json({ error: { message: "Phiên đăng nhập không hợp lệ." } }, { status: 401 });
  try {
    const body = await request.json() as { password?: string };
    const password = typeof body.password === "string" ? body.password : "";
    if (password.length < 10 || password.length > 128) {
      return Response.json({ error: { message: "Mật khẩu mới phải có từ 10 đến 128 ký tự." } }, { status: 400 });
    }
    const { env } = await getCloudflareContext({ async: true }) as unknown as { env: StaffPasswordEnv };
    const result = await env.PINO_STAFF_PASSWORD_CORE.changePassword(token, { password });
    const headers = new Headers({ "cache-control": "no-store" });
    headers.append("set-cookie", `pino_staff_password_session=${result.token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`);
    return Response.json({ data: { changed: true, passwordChangeRequired: false } }, { status: 200, headers });
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "Không thể đổi mật khẩu.";
    return Response.json({ error: { message } }, { status: 400, headers: { "cache-control": "no-store" } });
  }
}

function cookie(request: Request, name: string): string {
  return request.headers.get("cookie")?.split(";").map(value => value.trim())
    .find(value => value.startsWith(`${name}=`))?.slice(name.length + 1) ?? "";
}
