import type { JWTVerifyGetKey } from "jose";
import { authenticateBo, BoAuthError } from "./bo-auth";
import { callBoAccessCore, type BoAccessCoreBinding } from "./bo-core";
import { stagingBoOpenStudioIdentity, type BoOpenStudioStagingAuthEnv } from "./bo-open-studio-staging-auth";
import { stagingBoWorkforceIdentity, type BoWorkforceStagingAuthEnv } from "./bo-workforce-staging-auth";

export interface BoReadEnv extends BoWorkforceStagingAuthEnv, BoOpenStudioStagingAuthEnv {
  PINO_BO_CORE: BoAccessCoreBinding;
  CF_ACCESS_TEAM_DOMAIN: string;
  CF_ACCESS_BO_AUD: string;
}

const OPEN_STUDIO_POLICY_READ = /^policies\/open_studio\/(monthly_path_pass\.v1|bring_a_friend\.v1|public_acquisition\.v1|cancellation\.v1)\/(effective|stream)$/;
const PRACTICE_RESOURCE_READ = /^practice\/resources\/[0-9a-f-]{36}$/;

export async function handleBoOperationalReadRequest(
  request: Request,
  env: BoReadEnv,
  path: string,
  keyResolver?: JWTVerifyGetKey,
): Promise<Response> {
  try {
    if (request.method !== "GET") return json({ error: { code: "PLATFORM_METHOD_NOT_ALLOWED", message: "Method not allowed" } }, 405);
    if (!isOperationalReadPath(path)) return json({ error: { code: "PLATFORM_NOT_FOUND", message: "BO operation not found" } }, 404);
    const stagingIdentity = isOpenStudioReadPath(path)
      ? stagingBoOpenStudioIdentity(request, env)
      : isPracticeReadPath(path)
        ? null
        : stagingBoWorkforceIdentity(request, env);
    const identity = stagingIdentity ?? await authenticateBo(
      request.headers,
      { teamDomain: env.CF_ACCESS_TEAM_DOMAIN, audience: env.CF_ACCESS_BO_AUD },
      keyResolver,
    );
    const url = new URL(request.url);
    const readBody = readQueryBody(path, url);
    const corePath = readCorePath(path, url);
    const result = await callBoAccessCore(env.PINO_BO_CORE, { method: "GET", path: corePath, ...(readBody ? { body: readBody } : {}) }, identity);
    return json(result.body, result.status, { "x-request-id": result.requestId });
  } catch (error) {
    if (error instanceof BoAuthError) {
      return json({ error: { code: "IDENTITY_AUTHENTICATION_FAILED", message: error.message } }, error.status);
    }
    console.error("BO operational read facade failure", error instanceof Error ? error.message : "unknown");
    return json({ error: { code: "PLATFORM_INTERNAL_ERROR", message: "An unexpected error occurred" } }, 500);
  }
}

export function isPracticeReadPath(path: string): boolean {
  return path === "practice/authoring-context" || path === "practice/repertoire-access/context" || path === "practice/repertoire-access" || path === "practice/resources" || PRACTICE_RESOURCE_READ.test(path);
}

export function isOpenStudioReadPath(path: string): boolean {
  return path.startsWith("open-studio/") || OPEN_STUDIO_POLICY_READ.test(path);
}

export function isOperationalReadPath(path: string): boolean {
  return path === "centers"
    || path === "delivery/bootstrap-state"
    || path === "path-programs"
    || path === "running-classes"
    || path === "syllabi"
    || path === "learning/syllabi"
    || path === "learning/syllabi/owners"
    || /^learning\/syllabi\/[0-9a-f-]{36}$/.test(path)
    || path === "sessions"
    || path === "access/roles"
    || path === "access/permissions"
    || path === "access/audit"
    || path === "access/users"
    || path === "workforce/staff-records"
    || path === "workforce/staff-registration-settings"
    || path === "workforce/staff-registration-requests"
    || path === "learners"
    || path === "practice/authoring-context"
    || path === "practice/repertoire-access/context"
    || path === "practice/repertoire-access"
    || path === "practice/resources"
    || PRACTICE_RESOURCE_READ.test(path)
    || path === "open-studio/operations"
    || path === "open-studio/listing-catalog"
    || path === "open-studio/learners"
    || path === "open-studio/passes"
    || OPEN_STUDIO_POLICY_READ.test(path)
    || /^open-studio\/passes\/[0-9a-f-]{36}\/claim-eligibility$/.test(path)
    || /^open-studio\/students\/[0-9a-f-]{36}\/lifecycle$/.test(path)
    || /^students\/[0-9a-f-]{36}\/lifecycle$/.test(path)
    || /^access\/roles\/[0-9a-f-]{36}$/.test(path)
    || /^workforce\/staff-records\/[0-9a-f-]{36}$/.test(path)
    || /^sessions\/[0-9a-f-]+\/registrations$/.test(path)
    || /^sessions\/[0-9a-f-]{36}\/learning-owner$/.test(path);
}

function readCorePath(path: string, url: URL): string {
  if (path === "practice/repertoire-access") {
    const params = new URLSearchParams();
    for (const key of ["studentProfileId", "pathProgramId", "effectiveAt"] as const) {
      const value = url.searchParams.get(key);
      if (value !== null) params.set(key, value);
    }
    const query = params.toString();
    return query ? `${path}?${query}` : path;
  }
  if (path === "practice/resources") {
    const pathProgramId = url.searchParams.get("pathProgramId")?.trim() ?? "";
    return pathProgramId ? `${path}?pathProgramId=${encodeURIComponent(pathProgramId)}` : path;
  }
  if (path === "learning/syllabi") {
    const params = new URLSearchParams();
    const ownerType = url.searchParams.get("ownerType");
    const ownerId = url.searchParams.get("ownerId");
    if (ownerType !== null) params.set("ownerType", ownerType);
    if (ownerId !== null) params.set("ownerId", ownerId);
    const query = params.toString();
    return query ? `${path}?${query}` : path;
  }
  return path;
}

function readQueryBody(path: string, url: URL): Record<string, unknown> | undefined {
  if (path === "access/audit") {
    const limit = url.searchParams.get("limit");
    return limit ? { limit: Number(limit) } : undefined;
  }
  if (path === "learners" || path === "open-studio/learners") return {
    ...(url.searchParams.get("query") ? { query: url.searchParams.get("query")! } : {}),
    ...(url.searchParams.get("limit") ? { limit: Number(url.searchParams.get("limit")) } : {}),
    ...(url.searchParams.get("offset") ? { offset: Number(url.searchParams.get("offset")) } : {}),
  };
  if (path === "open-studio/operations") return url.searchParams.get("centerId") ? { centerId: url.searchParams.get("centerId")! } : undefined;
  if (path === "open-studio/listing-catalog") return { ...(url.searchParams.get("centerId") ? { centerId: url.searchParams.get("centerId")! } : {}), ...(url.searchParams.get("effectiveAt") ? { effectiveAt: url.searchParams.get("effectiveAt")! } : {}) };
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
