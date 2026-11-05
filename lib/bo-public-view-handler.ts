import { boPublicViewCoreRoute } from "./bo-public-view-route-guard";
import { callBoAccessCoreWithCredential, type BoAccessCoreBinding } from "./bo-core";
import { teamCredential, TeamAuthError, type TeamAccessEnv } from "./team-auth";

export type BoPublicViewEnv = TeamAccessEnv & { PINO_BO_CORE: BoAccessCoreBinding };
/** Authenticated BO BFF boundary. Core remains the only authority for writes and versions. */
export async function handleBoPublicViewRequest(request: Request, env: BoPublicViewEnv, path: string): Promise<Response> {
  const allowed = boPublicViewCoreRoute(path, request.method);
  if (!allowed) return Response.json({ error: { code: "PLATFORM_NOT_FOUND" } }, { status: 404 });
  try {
    const credential = await teamCredential(request, env, "BO");
    let body: unknown;
    if (request.method !== "GET") {
      try { body = await request.json(); }
      catch { return Response.json({ error: { code: "PLATFORM_INVALID_INPUT" } }, { status: 400 }); }
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return Response.json({ error: { code: "PLATFORM_INVALID_INPUT" } }, { status: 400 });
      }
    }
    const result = await callBoAccessCoreWithCredential(env.PINO_BO_CORE, {
      path: allowed,
      method: request.method,
      ...(request.method !== "GET" ? { body } : {}),
    }, credential);
    return Response.json(result.body, { status: result.status, headers: { "cache-control": "no-store", "x-request-id": result.requestId } });
  } catch (error) {
    if (error instanceof TeamAuthError) {
      return Response.json({ error: { code: "IDENTITY_AUTHENTICATION_FAILED" } }, { status: error.status });
    }
    return Response.json({ error: { code: "PLATFORM_INTERNAL_ERROR" } }, { status: 500 });
  }
}