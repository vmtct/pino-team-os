import type { JWTVerifyGetKey } from "jose";
import { authenticateWorkforce, WorkforceAuthError } from "./workforce-auth";
import type { StaffPinCoreBinding } from "./staff-pin-core";
import { stagingStaffEmail, type TosStagingAuthEnv } from "./tos-staging-auth";

export type StaffPinLoginEnv = TosStagingAuthEnv & {
  PINO_STAFF_PIN_CORE: StaffPinCoreBinding;
  CF_ACCESS_TEAM_DOMAIN: string;
  CF_ACCESS_TOS_AUD: string;
};

export async function handleStaffPinLogin(
  request: Request,
  env: StaffPinLoginEnv,
  keyResolver?: JWTVerifyGetKey,
): Promise<Response> {
  try {
    const stagingEmail = stagingStaffEmail(request, env);
    const identity = stagingEmail ? null : await authenticateWorkforce(
      request.headers,
      { teamDomain: env.CF_ACCESS_TEAM_DOMAIN, audience: env.CF_ACCESS_TOS_AUD },
      keyResolver,
    );
    const input = await request.json() as { pin?: string };
    const result = await env.PINO_STAFF_PIN_CORE.login({
      loginIdentifier: stagingEmail ?? identity!.email,
      pin: input.pin ?? "",
    });
    const headers = new Headers({ "cache-control": "no-store", "x-request-id": result.requestId });
    if (result.status === 200) {
      const token = ((result.body as { data?: { token?: string } }).data?.token) ?? "";
      headers.append("set-cookie", `pino_staff_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`);
    }
    return Response.json(result.body, { status: result.status, headers });
  } catch (error) {
    if (error instanceof WorkforceAuthError) {
      return Response.json(
        { error: { code: "IDENTITY_AUTHENTICATION_FAILED", message: error.message } },
        { status: error.status },
      );
    }
    return Response.json(
      { error: { code: "PLATFORM_INTERNAL_ERROR", message: "Không thể đăng nhập bằng PIN" } },
      { status: 500 },
    );
  }
}
