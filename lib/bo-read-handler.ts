import type { JWTVerifyGetKey } from "jose";
import { authenticateBo, BoAuthError } from "./bo-auth";
import { callBoAccessCore, type BoAccessCoreBinding } from "./bo-core";

export interface BoReadEnv {
  PINO_BO_CORE: BoAccessCoreBinding;
  CF_ACCESS_TEAM_DOMAIN: string;
  CF_ACCESS_BO_AUD: string;
}

export async function handleBoOperationalReadRequest(
  request: Request,
  env: BoReadEnv,
  path: string,
  keyResolver?: JWTVerifyGetKey,
): Promise<Response> {
  try {
    if (request.method !== "GET") return json({ error: { code: "PLATFORM_METHOD_NOT_ALLOWED", message: "Method not allowed" } }, 405);
    if (!isOperationalReadPath(path)) return json({ error: { code: "PLATFORM_NOT_FOUND", message: "BO operation not found" } }, 404);
    const identity = await authenticateBo(
      request.headers,
      { teamDomain: env.CF_ACCESS_TEAM_DOMAIN, audience: env.CF_ACCESS_BO_AUD },
      keyResolver,
    );
    const result = await callBoAccessCore(env.PINO_BO_CORE, { method: "GET", path }, identity);
    return json(result.body, result.status, { "x-request-id": result.requestId });
  } catch (error) {
    if (error instanceof BoAuthError) {
      return json({ error: { code: "IDENTITY_AUTHENTICATION_FAILED", message: error.message } }, error.status);
    }
    console.error("BO operational read facade failure", error instanceof Error ? error.message : "unknown");
    return json({ error: { code: "PLATFORM_INTERNAL_ERROR", message: "An unexpected error occurred" } }, 500);
  }
}

export function isOperationalReadPath(path: string): boolean {
  return path === "path-programs"
    || path === "running-classes"
    || path === "syllabi"
    || path === "sessions"
    || /^sessions\/[0-9a-f-]+\/registrations$/.test(path);
}

function json(body: unknown, status: number, headers: HeadersInit = {}): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}
