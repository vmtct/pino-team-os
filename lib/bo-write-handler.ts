import { callBoAccessCoreWithStaffPassword, type BoAccessCoreBinding, type BoAccessRequest } from "./bo-core";
import { LocalStaffSessionError, staffPasswordSession } from "./local-staff-session";

export interface BoWriteEnv {
  PINO_BO_CORE: BoAccessCoreBinding;
}

const STAFF_ONBOARDING_PATH = "workforce/staff-onboarding";
const STAFF_REGISTRATION_SETTINGS_PATH = "workforce/staff-registration-settings";
const STAFF_REGISTRATION_REVIEW_PATH = /^workforce\/staff-registration-requests\/[0-9a-f-]{36}\/(approve|reject)$/;
const LEARNING_SYLLABUS_CREATE = "learning/syllabi";
const LEARNING_SYLLABUS_COMMAND = /^learning\/syllabi\/[0-9a-f-]{36}\/(draft|publish|next-draft|archive)$/;
const ACCESS_ROLE_PATH = "access/roles";
const ACCESS_ROLE_DUPLICATE_PATH = /^access\/roles\/[0-9a-f-]{36}\/duplicate$/;
const ACCESS_ROLE_UPDATE_PATH = /^access\/roles\/[0-9a-f-]{36}\/update$/;
const ACCESS_ROLE_ARCHIVE_PATH = /^access\/roles\/[0-9a-f-]{36}\/archive$/;
const ACCESS_ASSIGNMENT_PATH = "access/assignments";
const ACCESS_ASSIGNMENT_REMOVE_PATH = "access/assignments/remove";
const ACCESS_USER_STATUS_PATH = "access/users/status";
const STAFF_PIN_RESET_PATH = /^access\/users\/[0-9a-f-]{36}\/staff-pin\/reset$/;
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
const STUDENT_COMPANION_FEED_PATH = /^students\/[0-9a-f-]{36}\/pinoria\/companions\/[0-9a-f-]{36}\/feed$/;
const SUBSCRIPTION_CREATE_PATH = "subscriptions";
const SUBSCRIPTION_COMMAND_PATH = /^subscriptions\/[0-9a-f-]{36}\/(activate|renew|supersede|cancel|service-grants|pauses|renewal-grace)$/;
const SUBSCRIPTION_PAUSE_CANCEL_PATH = /^subscription-pauses\/[0-9a-f-]{36}\/cancel$/;
const RENEWAL_GRACE_REVOKE_PATH = /^renewal-grace\/[0-9a-f-]{36}\/revoke$/;
const ENROLLMENT_CREATE_PATH = "enrollments";
const ENROLLMENT_COMMAND_PATH = /^enrollments\/[0-9a-f-]{36}\/(transfer|end)$/;
const ENROLLMENT_BULK_PATHS = new Set(["enrollments/bulk-preflight", "enrollments/bulk-place"]);
const OPEN_STUDIO_LISTING_CREATE = "open-studio/listings";
const OPEN_STUDIO_LISTING_COMMAND = /^open-studio\/listings\/[0-9a-f-]{36}\/(publish|close|cancel)$/;
const OPEN_STUDIO_CENTER_COMMAND = /^open-studio\/(member-path-centers|member-centers)\/(assign|reassign)$/;
const OPEN_STUDIO_PASS_ISSUE = new Set(["open-studio/passes/issue-monthly-path", "open-studio/passes/issue-bring-a-friend"]);
const OPEN_STUDIO_PASS_REVOKE = /^open-studio\/passes\/[0-9a-f-]{36}\/revoke$/;
const OPEN_STUDIO_ADMISSION = "open-studio/admission";
const OPEN_STUDIO_POLICY_VERSION = /^policies\/open_studio\/(monthly_path_pass\.v1|bring_a_friend\.v1|public_acquisition\.v1|cancellation\.v1)\/versions$/;
const OPEN_STUDIO_POLICY_PUBLISH = /^policies\/open_studio\/(monthly_path_pass\.v1|bring_a_friend\.v1|public_acquisition\.v1|cancellation\.v1)\/versions\/[0-9a-f-]{36}\/publish$/;
const PRACTICE_REPERTOIRE_GRANT = "practice/repertoire-access/grants";
const PRACTICE_REPERTOIRE_REVOKE = /^practice\/repertoire-access\/grants\/[0-9a-f-]{36}\/revoke$/;
const PRACTICE_RESOURCE_CREATE = "practice/resources";
const PRACTICE_RESOURCE_DRAFT = /^practice\/resources\/[0-9a-f-]{36}\/drafts$/;
const PRACTICE_VERSION_COMMAND = /^practice\/versions\/[0-9a-f-]{36}(?:\/(?:pages|publish))?$/;
const WARD_CATALOG_WRITE = /^pinoria\/ward\/catalog\/(items|variants)(?:\/[0-9a-f-]{36})?$/;
const WARD_SET_WRITE = /^pinoria\/ward\/sets(?:\/[0-9a-f-]{36}(?:\/members)?)?$/;
const WARD_SET_MEDIA = "pinoria/ward/set-webm-assets";

export async function handleBoWriteRequest(
  request: Request,
  env: BoWriteEnv,
  path: string,
  _legacyKeyResolver?: unknown,
): Promise<Response> {
  try {
    if (request.method !== "POST" && !(request.method === "PATCH" && (WARD_CATALOG_WRITE.test(path) || WARD_SET_WRITE.test(path))) && !(request.method === "PUT" && WARD_SET_WRITE.test(path))) return json({ error: { code: "PLATFORM_METHOD_NOT_ALLOWED", message: "Method not allowed" } }, 405);
    if (!isAllowedPostPath(path)) return json({ error: { code: "PLATFORM_NOT_FOUND", message: "BO operation not found" } }, 404);

    const passwordToken = staffPasswordSession(request);

    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    if ((path === STAFF_ONBOARDING_PATH || STAFF_REGISTRATION_REVIEW_PATH.test(path) || STAFF_PIN_RESET_PATH.test(path) || LEARNING_OWNER_PATH.test(path) || STUDENT_COMPANION_FEED_PATH.test(path) || isPracticeWritePath(path) || isLearningSyllabusPostPath(path)) && !idempotencyKey) {
      return json({ error: { code: "PLATFORM_INVALID_INPUT", message: "Idempotency-Key is required" } }, 400);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: { code: "PLATFORM_INVALID_INPUT", message: "A JSON request body is required" } }, 400);
    }

    if ((PARENT_PIN_PATH.test(path) || STAFF_PIN_RESET_PATH.test(path)) && (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body as Record<string, unknown>).length !== 0)) {
      return json({ error: { code: "PLATFORM_INVALID_INPUT", message: STAFF_PIN_RESET_PATH.test(path) ? "Staff PIN reset body must be empty" : "Parent PIN command body must be empty" } }, 400);
    }

    const coreRequest: BoAccessRequest = {
      method: request.method,
      path,
      body,
      ...(idempotencyKey ? { idempotencyKey } : {}),
    };
    const result = await callBoAccessCoreWithStaffPassword(env.PINO_BO_CORE, coreRequest, passwordToken);
    return json(result.body, result.status, { "x-request-id": result.requestId });
  } catch (error) {
    if (error instanceof LocalStaffSessionError) {
      return json({ error: { code: "IDENTITY_AUTHENTICATION_FAILED", message: error.message } }, 401);
    }
    console.error("BO write facade failure", error instanceof Error ? error.message : "unknown");
    return json({ error: { code: "PLATFORM_INTERNAL_ERROR", message: "An unexpected error occurred" } }, 500);
  }
}

export function shouldReconcileTosAccess(path: string): boolean {
  return path === STAFF_ONBOARDING_PATH
    || (STAFF_REGISTRATION_REVIEW_PATH.test(path) && path.endsWith("/approve"))
    || ACCESS_ROLE_UPDATE_PATH.test(path)
    || ACCESS_ROLE_ARCHIVE_PATH.test(path)
    || path === ACCESS_ASSIGNMENT_PATH
    || path === ACCESS_ASSIGNMENT_REMOVE_PATH
    || path === ACCESS_USER_STATUS_PATH
    || STAFF_STATUS_PATH.test(path);
}

export function isPracticeWritePath(path: string): boolean {
  return path === PRACTICE_REPERTOIRE_GRANT || PRACTICE_REPERTOIRE_REVOKE.test(path) || path === PRACTICE_RESOURCE_CREATE || PRACTICE_RESOURCE_DRAFT.test(path) || PRACTICE_VERSION_COMMAND.test(path);
}

export function isLearningSyllabusPostPath(path: string): boolean {
  return path === LEARNING_SYLLABUS_CREATE || LEARNING_SYLLABUS_COMMAND.test(path);
}

export function isOpenStudioPostPath(path: string): boolean {
  return path === OPEN_STUDIO_LISTING_CREATE
    || OPEN_STUDIO_LISTING_COMMAND.test(path)
    || OPEN_STUDIO_CENTER_COMMAND.test(path)
    || OPEN_STUDIO_PASS_ISSUE.has(path)
    || OPEN_STUDIO_PASS_REVOKE.test(path)
    || path === OPEN_STUDIO_ADMISSION
    || OPEN_STUDIO_POLICY_VERSION.test(path)
    || OPEN_STUDIO_POLICY_PUBLISH.test(path);
}

export function isAllowedPostPath(path: string): boolean {
  return path === STAFF_ONBOARDING_PATH
    || path === STAFF_REGISTRATION_SETTINGS_PATH
    || STAFF_REGISTRATION_REVIEW_PATH.test(path)
    || path === ACCESS_ROLE_PATH
    || ACCESS_ROLE_DUPLICATE_PATH.test(path)
    || ACCESS_ROLE_UPDATE_PATH.test(path)
    || ACCESS_ROLE_ARCHIVE_PATH.test(path)
    || path === ACCESS_ASSIGNMENT_PATH
    || path === ACCESS_ASSIGNMENT_REMOVE_PATH
    || path === ACCESS_USER_STATUS_PATH
    || STAFF_PIN_RESET_PATH.test(path)
    || STAFF_RECORD_PATH.test(path)
    || STAFF_STATUS_PATH.test(path)
    || DELIVERY_POST_PATHS.has(path)
    || MATERIALIZATION_PUBLISH.test(path)
    || LEARNING_OWNER_PATH.test(path)
    || PARENT_PIN_PATH.test(path)
    || STUDENT_COMPANION_FEED_PATH.test(path)
    || path === SUBSCRIPTION_CREATE_PATH
    || SUBSCRIPTION_COMMAND_PATH.test(path)
    || SUBSCRIPTION_PAUSE_CANCEL_PATH.test(path)
    || RENEWAL_GRACE_REVOKE_PATH.test(path)
    || path === ENROLLMENT_CREATE_PATH
    || ENROLLMENT_COMMAND_PATH.test(path)
    || isPracticeWritePath(path)
    || ENROLLMENT_BULK_PATHS.has(path)
    || isLearningSyllabusPostPath(path)
    || isOpenStudioPostPath(path)
    || WARD_CATALOG_WRITE.test(path)
    || WARD_SET_WRITE.test(path)
    || path === WARD_SET_MEDIA;
}

/** Compatibility export for the existing onboarding facade tests/callers. */
export const handleBoStaffOnboardingRequest = handleBoWriteRequest;

function json(body: unknown, status: number, headers: HeadersInit = {}): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}
