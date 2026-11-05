import { authorizeHoShell, type HoEnv } from "./ho-auth";
import { BoShellGateError } from "./bo-shell-gate";
import { HO_STAGING_HOSTNAME } from "./host-boundary";
import { callBoAccessCoreWithCredential, type BoAccessCoreBinding } from "./bo-core";
import { teamCredential, TeamAuthError, type TeamAccessEnv } from "./team-auth";

export interface BoContextEnv extends TeamAccessEnv {
  APP_ENV?: string; HO_PILOT_FOUNDER_USER_IDS?: string;
  PINO_BO_CORE: BoAccessCoreBinding;
}

export async function handleBoContextRequest(
  request: Request,
  env: BoContextEnv,
  _legacyKeyResolver?: unknown,
): Promise<Response> {
  try {
    if (request.method !== "GET") return json({ error: { code: "PLATFORM_METHOD_NOT_ALLOWED", message: "Method not allowed" } }, 405);
    if (new URL(request.url).hostname === HO_STAGING_HOSTNAME) {
      const context = await authorizeHoShell(request.headers, env as HoEnv);
      return json({ data: context }, 200);
    }
    // PAP-1426: a strict selected-Center capability projection; the URL is never a grant.
    const query = new URL(request.url).searchParams;
    const keys = [...query.keys()];
    const centers = query.getAll("centerId");
    if (keys.length && (keys.length !== 1 || keys[0] !== "centerId" || centers.length !== 1 ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(centers[0]!))) {
      return json({ error: { code: "PLATFORM_INVALID_INPUT", message: "Exactly one valid Center is required" } }, 400);
    }
    const centerId = centers[0];
    const result = await callBoAccessCoreWithCredential(
      env.PINO_BO_CORE,
      { method: "GET", path: "context", ...(centerId ? { resource: { centerId } } : {}) },
      await teamCredential(request, env, "BO"),
    );
    return json(result.body, result.status, { "x-request-id": result.requestId });
  } catch (error) {
    if (error instanceof BoShellGateError) return json({ error: { code: "HO_ACCESS_DENIED", message: error.message } }, error.status);
    if (error instanceof TeamAuthError) return json({ error: { code: "IDENTITY_AUTHENTICATION_FAILED", message: error.message } }, error.status);
    console.error("BO context facade failure", error instanceof Error ? error.message : "unknown");
    return json({ error: { code: "PLATFORM_INTERNAL_ERROR", message: "An unexpected error occurred" } }, 500);
  }
}
function json(body: unknown, status: number, headers: HeadersInit = {}): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}