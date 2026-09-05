import type { StaffPinCoreBinding } from "./staff-pin-core";

export type StaffPinLoginEnv = {
  PINO_STAFF_PIN_CORE: StaffPinCoreBinding;
};

export async function handleStaffPinLogin(
  request: Request,
  env: StaffPinLoginEnv,
  _legacyKeyResolver?: unknown,
): Promise<Response> {
  try {
    const input = await request.json() as { email?: string; pin?: string };
    const email = input.email?.trim().toLowerCase() ?? "";
    if (!email || !email.includes("@")) return Response.json({ error: { code: "PLATFORM_INVALID_INPUT", message: "Email Staff is required" } }, { status: 400 });
    const result = await env.PINO_STAFF_PIN_CORE.login({ loginIdentifier: email, pin: input.pin ?? "" });
    const headers = new Headers({ "cache-control": "no-store", "x-request-id": result.requestId });
    if (result.status === 200) {
      const token = ((result.body as { data?: { token?: string } }).data?.token) ?? "";
      headers.append("set-cookie", `pino_staff_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`);
    }
    return Response.json(result.body, { status: result.status, headers });
  } catch {
    return Response.json({ error: { code: "PLATFORM_INTERNAL_ERROR", message: "Không thể đăng nhập bằng PIN" } }, { status: 500 });
  }
}