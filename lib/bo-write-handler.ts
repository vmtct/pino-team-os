import type { JWTVerifyGetKey } from "jose";
import { authenticateBo, BoAuthError } from "./bo-auth";
import { callBoAccessCore, type BoAccessCoreBinding } from "./bo-core";

export interface BoWriteEnv {
  PINO_BO_CORE: BoAccessCoreBinding;
  CF_ACCESS_TEAM_DOMAIN: string;
  CF_ACCESS_BO_AUD: string;
}

const STAFF_ONBOARDING_PATH = "workforce/staff-onboarding";

export async function handleBoStaffOnboardingRequest(
  request: Request,
  env: BoWriteEnv,
  path: string,
  keyResolver?: JWTVerifyGetKey,
): Promise<Response> {
  try {
    if (request.method !== "POST") return json({ error: { code: "PLATFORM_METHOD_NOT_ALLOWED", message: "Method not allowed" } }, 405);
    if (path !== STAFF_ONBOARDING_PATH) return json({ error: { code: "PLATFORM_NOT_FOUND", message: "BO operation not found" } }, 404);

    const identity = await authenticateBo(
      request.headers,
      { teamDomain: env.CF_ACCESS_TEAM_DOMAIN, audience: env.CF_ACCESS_BO_AUD },
      keyResolver,
    );
    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey) return json({ error: { code: "PLATFORM_INVALID_INPUT", message: "Idempotency-Key is required" } }, 400);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: { code: "PLATFORM_INVALID_INPUT", message: "A JSON request body is required" } }, 400);
    }

    const result = await callBoAccessCore(env.PINO_BO_CORE, {
      method: "POST",
      path: STAFF_ONBOARDING_PATH,
      body,
      idempotencyKey,
    }, identity);
    return json(result.body, result.status, { "x-request-id": result.requestId });
  } catch (error) {
    if (error instanceof BoAuthError) {
      return json({ error: { code: "IDENTITY_AUTHENTICATION_FAILED", message: error.message } }, error.status);
    }
    console.error("BO staff onboarding facade failure", error instanceof Error ? error.message : "unknown");
    return json({ error: { code: "PLATFORM_INTERNAL_ERROR", message: "An unexpected error occurred" } }, 500);
  }
}

function json(body: unknown, status: number, headers: HeadersInit = {}): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}
