import type { JWTVerifyGetKey } from "jose";
import { authenticateBo, BoAuthError } from "./bo-auth";
import { callBoAccessCore, type BoAccessCoreBinding } from "./bo-core";
import { stagingBoWorkforceIdentity, type BoWorkforceStagingAuthEnv } from "./bo-workforce-staging-auth";

export interface BoReadEnv extends BoWorkforceStagingAuthEnv {
  PINO_BO_CORE: BoAccessCoreBinding;
  CF_ACCESS_TEAM_DOMAIN: string;
  CF_ACCESS_BO_AUD: string;
}

const OPEN_STUDIO_POLICY_READ = /^policies\/open_studio\/(monthly_path_pass\.v1|bring_a_friend\.v1|public_acquisition\.v1|cancellation\.v1)\/(effective|stream)$/;

export async function handleBoOperationalReadRequest(
  request: Request,
  env: BoReadEnv,
  path: string,
  keyResolver?: JWTVerifyGetKey,
): Promise<Response> {
  try {
    if (request.method !== "GET") return json({ error: { code: "PLATFORM_METHOD_NOT_ALLOWED", message: "Method not allowed" } }, 405);
    if (!isOperationalReadPath(path)) return json({ error: { code: "PLATFORM_NOT_FOUND", message: "BO operation not found" } }, 404);
    const identity = stagingBoWorkforceIdentity(request, env) ?? await authenticateBo(
      request.headers,
      { teamDomain: env.CF_ACCESS_TEAM_DOMAIN, audience: env.CF_ACCESS_BO_AUD },
      keyResolver,
    );
    const url = new URL(request.url);
    const readBody = readQueryBody(path, url);
    const result = await callBoAccessCore(env.PINO_BO_CORE, { method: "GET", path, ...(readBody ? { body: readBody } : {}) }, identity);
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
  return path === "centers"
    || path === "delivery/bootstrap-state"
    || path === "path-programs"
    || path === "running-classes"
    || path === "syllabi"
    || path === "sessions"
    || path === "access/roles"
    || path === "access/users"
    || path === "workforce/staff-records"
    || path === "learners"
    || path === "open-studio/operations"
    || path === "open-studio/passes"
    || OPEN_STUDIO_POLICY_READ.test(path)
    || /^open-studio\/passes\/[0-9a-f-]{36}\/claim-eligibility$/.test(path)
    || /^students\/[0-9a-f-]{36}\/lifecycle$/.test(path)
    || /^workforce\/staff-records\/[0-9a-f-]{36}$/.test(path)
    || /^sessions\/[0-9a-f-]+\/registrations$/.test(path)
    || /^sessions\/[0-9a-f-]{36}\/learning-owner$/.test(path);
}

function readQueryBody(path: string, url: URL): Record<string, unknown> | undefined {
  if (path === "learners") return {
    ...(url.searchParams.get("query") ? { query: url.searchParams.get("query")! } : {}),
    ...(url.searchParams.get("limit") ? { limit: Number(url.searchParams.get("limit")) } : {}),
  };
  if (path === "open-studio/operations") return url.searchParams.get("centerId") ? { centerId: url.searchParams.get("centerId")! } : undefined;
  if (path === "open-studio/passes") return { houseMembershipId: url.searchParams.get("houseMembershipId"), effectiveAt: url.searchParams.get("effectiveAt") };
  if (/^open-studio\/passes\/[0-9a-f-]{36}\/claim-eligibility$/.test(path)) return {
    listingId: url.searchParams.get("listingId"), participantMode: url.searchParams.get("participantMode"),
    studentProfileId: url.searchParams.get("studentProfileId"), effectiveAt: url.searchParams.get("effectiveAt"),
  };
  if (OPEN_STUDIO_POLICY_READ.test(path)) {
    const targetType = url.searchParams.get("targetType");
    const targetId = url.searchParams.get("targetId");
    return {
      targetType,
      targetId: targetType === "CENTER" ? targetId : null,
      ...(path.endsWith("/effective") ? { effectiveAt: url.searchParams.get("effectiveAt") } : {}),
    };
  }
  return undefined;
}
function json(body: unknown, status: number, headers: HeadersInit = {}): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}
