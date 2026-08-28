import type { JWTVerifyGetKey } from "jose";
import { authenticateBo, BoAuthError } from "./bo-auth";
import { callBoAccessCore, type BoAccessCoreBinding, type BoAccessRequest } from "./bo-core";

export interface BoWriteEnv {
  PINO_BO_CORE: BoAccessCoreBinding;
  CF_ACCESS_TEAM_DOMAIN: string;
  CF_ACCESS_BO_AUD: string;
}

const STAFF_ONBOARDING_PATH = "workforce/staff-onboarding";
const ACCESS_ROLE_PATH = "access/roles";
const ACCESS_ASSIGNMENT_PATH = "access/assignments";
const DELIVERY_POST_PATHS = new Set([
  "delivery/learning-spaces",
  "delivery/running-classes",
  "delivery/running-class-blocks",
  "delivery/materializations",
  "policies/delivery/materialization.v1/versions",
]);
const MATERIALIZATION_PUBLISH = /^policies\/delivery\/materialization\.v1\/versions\/[0-9a-f-]{36}\/publish$/;
const LEARNING_OWNER_PATH = /^sessions\/[0-9a-f-]{36}\/learning-owner$/;

export async function handleBoWriteRequest(
  request: Request,
  env: BoWriteEnv,
  path: string,
  keyResolver?: JWTVerifyGetKey,
): Promise<Response> {
  try {
    if (request.method !== "POST") return json({ error: { code: "PLATFORM_METHOD_NOT_ALLOWED", message: "Method not allowed" } }, 405);
    if (!isAllowedPostPath(path)) return json({ error: { code: "PLATFORM_NOT_FOUND", message: "BO operation not found" } }, 404);

    const identity = await authenticateBo(
      request.headers,
      { teamDomain: env.CF_ACCESS_TEAM_DOMAIN, audience: env.CF_ACCESS_BO_AUD },
      keyResolver,
    );

    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    if ((path === STAFF_ONBOARDING_PATH || LEARNING_OWNER_PATH.test(path)) && !idempotencyKey) {
      return json({ error: { code: "PLATFORM_INVALID_INPUT", message: "Idempotency-Key is required" } }, 400);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: { code: "PLATFORM_INVALID_INPUT", message: "A JSON request body is required" } }, 400);
    }

    const coreRequest: BoAccessRequest = {
      method: "POST",
      path,
      body,
      ...((path === STAFF_ONBOARDING_PATH || LEARNING_OWNER_PATH.test(path)) ? { idempotencyKey } : {}),
    };
    const result = await callBoAccessCore(env.PINO_BO_CORE, coreRequest, identity);
    return json(result.body, result.status, { "x-request-id": result.requestId });
  } catch (error) {
    if (error instanceof BoAuthError) {
      return json({ error: { code: "IDENTITY_AUTHENTICATION_FAILED", message: error.message } }, error.status);
    }
    console.error("BO write facade failure", error instanceof Error ? error.message : "unknown");
    return json({ error: { code: "PLATFORM_INTERNAL_ERROR", message: "An unexpected error occurred" } }, 500);
  }
}

export function isAllowedPostPath(path: string): boolean {
  return path === STAFF_ONBOARDING_PATH
    || path === ACCESS_ROLE_PATH
    || path === ACCESS_ASSIGNMENT_PATH
    || DELIVERY_POST_PATHS.has(path)
    || MATERIALIZATION_PUBLISH.test(path)
    || LEARNING_OWNER_PATH.test(path);
}

/** Compatibility export for the existing onboarding facade tests/callers. */
export const handleBoStaffOnboardingRequest = handleBoWriteRequest;

function json(body: unknown, status: number, headers: HeadersInit = {}): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}
