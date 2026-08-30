import type { JWTVerifyGetKey } from "jose";
import { authenticateGoogleCredential, GoogleAuthError } from "./google-auth";
import type { StaffPinCoreBinding } from "./staff-pin-core";

export type StaffPinLoginEnv = {
  PINO_STAFF_PIN_CORE: StaffPinCoreBinding;
  GOOGLE_SSO_CLIENT_ID: string;
};

export async function handleStaffPinLogin(
  request: Request,
  env: StaffPinLoginEnv,
  keyResolver?: JWTVerifyGetKey,
): Promise<Response> {
  try {
    const input = await request.json() as { credential?: string; pin?: string };
    const identity = await authenticateGoogleCredential(
      input.credential ?? "",
      env.GOOGLE_SSO_CLIENT_ID,
      keyResolver,
    );
    const result = await env.PINO_STAFF_PIN_CORE.login({
      loginIdentifier: identity.email,
      pin: input.pin ?? "",
    });
    const headers = new Headers({
      "cache-control": "no-store",
      "x-request-id": result.requestId,
    });
    if (result.status === 200) {
      const token = ((result.body as { data?: { token?: string } }).data?.token) ?? "";
      if (!token) return Response.json(
        { error: { code: "PLATFORM_INTERNAL_ERROR", message: "Staff session was not issued" } },
        { status: 500, headers },
      );
      headers.append(
        "set-cookie",
        `pino_staff_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`,
      );
    }
    return Response.json(result.body, { status: result.status, headers });
  } catch (error) {
    if (error instanceof GoogleAuthError) {
      return Response.json(
        { error: { code: "IDENTITY_AUTHENTICATION_FAILED", message: error.message } },
        { status: error.status, headers: { "cache-control": "no-store" } },
      );
    }
    return Response.json(
      { error: { code: "PLATFORM_INTERNAL_ERROR", message: "Không thể đăng nhập bằng Google + PIN" } },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
