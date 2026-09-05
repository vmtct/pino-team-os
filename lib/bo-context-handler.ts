import { callBoAccessCoreWithCredential, type BoAccessCoreBinding } from "./bo-core";
import { teamCredential, TeamAuthError, type TeamAccessEnv } from "./team-auth";

export interface BoContextEnv extends TeamAccessEnv {
  PINO_BO_CORE: BoAccessCoreBinding;
}

export async function handleBoContextRequest(
  request: Request,
  env: BoContextEnv,
  _legacyKeyResolver?: unknown,
): Promise<Response> {
  try {
    if (request.method !== "GET") return json({ error: { code: "PLATFORM_METHOD_NOT_ALLOWED", message: "Method not allowed" } }, 405);
    const result = await callBoAccessCoreWithCredential(
      env.PINO_BO_CORE,
      { method: "GET", path: "context" },
      await teamCredential(request, env, "BO"),
    );
    return json(result.body, result.status, { "x-request-id": result.requestId });
  } catch (error) {
    if (error instanceof TeamAuthError) return json({ error: { code: "IDENTITY_AUTHENTICATION_FAILED", message: error.message } }, error.status);
    console.error("BO context facade failure", error instanceof Error ? error.message : "unknown");
    return json({ error: { code: "PLATFORM_INTERNAL_ERROR", message: "An unexpected error occurred" } }, 500);
  }
}
function json(body: unknown, status: number, headers: HeadersInit = {}): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}