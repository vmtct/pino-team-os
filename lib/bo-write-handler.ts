import type { JWTVerifyGetKey } from "jose";
import { authenticateBo, BoAuthError } from "./bo-auth";
import { callBoAccessCore, type BoAccessCoreBinding, type BoAccessRequest } from "./bo-core";
import { reconcileCanonicalTosAccess, type TosAccessSyncBinding } from "./tos-access-sync";

export interface BoWriteEnv {
  PINO_BO_CORE: BoAccessCoreBinding;
  CF_ACCESS_TEAM_DOMAIN: string;
  CF_ACCESS_BO_AUD: string;
  PINO_ACCESS_SYNC?: TosAccessSyncBinding;
}

const STAFF_ONBOARDING_PATH = "workforce/staff-onboarding";
const ACCESS_ROLE_PATH = "access/roles";
const ACCESS_ASSIGNMENT_PATH = "access/assignments";
const ACCESS_ASSIGNMENT_REMOVE_PATH = "access/assignments/remove";
const ACCESS_USER_STATUS_PATH = "access/users/status";
const ACCESS_PERIMETER_RECONCILE_PATH = "access/perimeter-reconcile";
const STAFF_RECORD_PATH = /^workforce\/staff-records\/[0-9a-f-]{36}$/;
const STAFF_STATUS_PATH = /^workforce\/staff-records\/[0-9a-f-]{36}\/status$/;
const DELIVERY_POST_PATHS = new Set([
  "delivery/learning-spaces",
  "delivery/running-classes",
  "delivery/running-class-blocks",
  "delivery/materializations",
  "policies/delivery/materialization.v1/versions",
]);
const MATERIALIZATION_PUBLISH = /^policies\/delivery\/materialization\.v1\/versions\/[0-9a-f-]{36}\/publish$/;
const LEARNING_OWNER_PATH = /^sessions\/[0-9a-f-]{36}\/learning-owner$/;
const PARENT_PIN_PATH = /^identity\/parents\/[0-9a-f-]{36}\/pin\/(issue-initial|reset)$/;

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

    if (PARENT_PIN_PATH.test(path) && (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body as Record<string, unknown>).length !== 0)) {
      return json({ error: { code: "PLATFORM_INVALID_INPUT", message: "Parent PIN command body must be empty" } }, 400);
    }

    if (path === ACCESS_PERIMETER_RECONCILE_PATH) {
      if (!env.PINO_ACCESS_SYNC) return json({ error: { code: "PLATFORM_NOT_CONFIGURED", message: "TOS Access sync is not configured" } }, 503);
      const syncResult = await reconcileCanonicalTosAccess(env.PINO_BO_CORE, env.PINO_ACCESS_SYNC, identity);
      return json({ data: syncResult }, 200, { "x-tos-access-sync": "ok" });
    }
    const coreRequest: BoAccessRequest = {
      method: "POST",
      path,
      body,
      ...((path === STAFF_ONBOARDING_PATH || LEARNING_OWNER_PATH.test(path)) ? { idempotencyKey } : {}),
    };
    const result = await callBoAccessCore(env.PINO_BO_CORE, coreRequest, identity);
    let syncState = "not_required";
    if (result.status >= 200 && result.status < 300 && env.PINO_ACCESS_SYNC && shouldReconcileTosAccess(path)) {
      try {
        await reconcileCanonicalTosAccess(env.PINO_BO_CORE, env.PINO_ACCESS_SYNC, identity);
        syncState = "ok";
      } catch (syncError) {
        syncState = "failed";
        console.error("TOS Access perimeter reconciliation failed", syncError instanceof Error ? syncError.message : "unknown");
      }
    }
    return json(result.body, result.status, { "x-request-id": result.requestId, "x-tos-access-sync": syncState });
  } catch (error) {
    if (error instanceof BoAuthError) {
      return json({ error: { code: "IDENTITY_AUTHENTICATION_FAILED", message: error.message } }, error.status);
    }
    console.error("BO write facade failure", error instanceof Error ? error.message : "unknown");
    return json({ error: { code: "PLATFORM_INTERNAL_ERROR", message: "An unexpected error occurred" } }, 500);
  }
}

export function shouldReconcileTosAccess(path: string): boolean {
  return path === ACCESS_PERIMETER_RECONCILE_PATH
    || path === STAFF_ONBOARDING_PATH
    || path === ACCESS_ASSIGNMENT_PATH
    || path === ACCESS_ASSIGNMENT_REMOVE_PATH
    || path === ACCESS_USER_STATUS_PATH
    || STAFF_STATUS_PATH.test(path);
}

export function isAllowedPostPath(path: string): boolean {
  return path === ACCESS_PERIMETER_RECONCILE_PATH
    || path === STAFF_ONBOARDING_PATH
    || path === ACCESS_ROLE_PATH
    || path === ACCESS_ASSIGNMENT_PATH
    || path === ACCESS_ASSIGNMENT_REMOVE_PATH
    || path === ACCESS_USER_STATUS_PATH
    || STAFF_RECORD_PATH.test(path)
    || STAFF_STATUS_PATH.test(path)
    || DELIVERY_POST_PATHS.has(path)
    || MATERIALIZATION_PUBLISH.test(path)
    || LEARNING_OWNER_PATH.test(path)
    || PARENT_PIN_PATH.test(path);
}

/** Compatibility export for the existing onboarding facade tests/callers. */
export const handleBoStaffOnboardingRequest = handleBoWriteRequest;

function json(body: unknown, status: number, headers: HeadersInit = {}): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}
