import { callBoAccessCoreWithStaffPassword, type BoAccessCoreBinding } from "./bo-core";

export interface BoContextEnv {
  PINO_BO_CORE: BoAccessCoreBinding;
  /** @deprecated greenfield runtime ignores external-IdP configuration. */
}

export async function handleBoContextRequest(
  request: Request,
  env: BoContextEnv,
  _legacyKeyResolver?: unknown,
): Promise<Response> {
  try {
    if (request.method !== "GET") return json({ error: { code: "PLATFORM_METHOD_NOT_ALLOWED", message: "Method not allowed" } }, 405);
    const passwordToken = requiredSession(request);
    const result = await callBoAccessCoreWithStaffPassword(
      env.PINO_BO_CORE,
      { method: "GET", path: "context" },
      passwordToken,
    );
    return json(result.body, result.status, { "x-request-id": result.requestId });
  } catch (error) {
    if (error instanceof LocalSessionError) return json({ error: { code: "IDENTITY_AUTHENTICATION_FAILED", message: error.message } }, 401);
    console.error("BO context facade failure", error instanceof Error ? error.message : "unknown");
    return json({ error: { code: "PLATFORM_INTERNAL_ERROR", message: "An unexpected error occurred" } }, 500);
  }
}
class LocalSessionError extends Error {}

function requiredSession(request: Request): string {
  const token = request.headers.get("cookie")?.split(";").map(v => v.trim())
    .find(v => v.startsWith("pino_staff_password_session="))?.slice("pino_staff_password_session=".length) ?? "";
  if (!token) throw new LocalSessionError("Staff password session is required");
  return token;
}

function json(body: unknown, status: number, headers: HeadersInit = {}): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}