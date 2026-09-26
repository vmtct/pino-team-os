import { callBoAccessCoreWithCredential, type BoAccessCoreBinding, type BoAccessRequest } from "./bo-core";
import { teamCredential, TeamAuthError, type TeamAccessEnv } from "./team-auth";

export interface BoWriteEnv extends TeamAccessEnv {
  PINO_BO_CORE: BoAccessCoreBinding;
}

const STAFF_ONBOARDING_PATH = "workforce/staff-onboarding";
const STAFF_REGISTRATION_SETTINGS_PATH = "workforce/staff-registration-settings";
const STAFF_REGISTRATION_REVIEW_PATH = /^workforce\/staff-registration-requests\/[0-9a-f-]{36}\/(approve|reject)$/;
const LEARNING_SYLLABUS_CREATE = "learning/syllabi";
const LEARNING_SYLLABUS_COMMAND = /^learning\/syllabi\/[0-9a-f-]{36}\/(draft|publish|next-draft|archive)$/;
const LEARNING_SYLLABUS_PROFILE = /^learning\/syllabi\/versions\/[0-9a-f-]{36}\/(artchitect-profile|pianohouse-profile|little-piner-profile)$/;
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
const TIMEKEEPING_CORRECTION_PATH = /^workforce\/timekeeping\/[0-9a-f-]{36}\/corrections$/;
const TIMEKEEPING_MISSED_CHECKOUT_PATH = /^workforce\/timekeeping\/[0-9a-f-]{36}\/resolve-missed-checkout$/;
const DELIVERY_POST_PATHS = new Set([
  "delivery/terms",
  "delivery/term-weeks",
  "delivery/learning-spaces",
  "delivery/running-classes",
  "delivery/running-class-blocks",
  "delivery/materializations",
  "delivery/calendar-exclusions",
  "policies/delivery/materialization.v1/versions",
]);
const TERM_WEEK_COMMAND = /^delivery\/term-weeks\/[0-9a-f-]{36}\/(update|delete)$/;
const TERM_NEUTRALIZE_COMMAND = /^delivery\/terms\/[0-9a-f-]{36}\/neutralize$/;
const DELIVERY_CONFIG_LIFECYCLE = /^delivery\/(?:learning-spaces|running-classes)\/[0-9a-f-]{36}\/lifecycle$/;
const MATERIALIZATION_PUBLISH = /^policies\/delivery\/materialization\.v1\/versions\/[0-9a-f-]{36}\/publish$/;
const LEARNING_OWNER_PATH = /^sessions\/[0-9a-f-]{36}\/learning-owner$/;
const SESSION_SYLLABUS_BINDING_PATH = /^delivery\/sessions\/[0-9a-f-]{36}\/syllabus-binding$/;
const CALENDAR_EXCLUSION_COMMAND = /^delivery\/calendar-exclusions\/[0-9a-f-]{36}$/;
const PARENT_PIN_PATH = /^identity\/parents\/[0-9a-f-]{36}\/pin\/(issue-initial|reset)$/;
const STUDENT_COMPANION_FEED_PATH = /^students\/[0-9a-f-]{36}\/pinoria\/companions\/[0-9a-f-]{36}\/feed$/;
const STUDENT_INTAKE_PATH = "student-intakes";
const STUDENT_INTAKE_VOID_PATH = /^student-intakes\/[0-9a-f-]{36}\/void$/;
const ACQUISITION_INTENT_COMMAND = /^acquisition\/intents\/[0-9a-f-]{36}\/(contacted|verify-contact|close)$/;
const BILLING_PLAN_CONFIG_PATH = /^billing\/product-plans\/([0-9a-f-]{36})\/configure$/;
const BILLING_SALE_PATH = "billing/sales";
const BILLING_TRANSACTION_PATH = /^billing\/bills\/[0-9a-f-]{36}\/transactions$/;
const BILLING_BILL_VOID_PATH = /^billing\/bills\/[0-9a-f-]{36}\/void$/;
const BILLING_TRANSACTION_VOID_PATH = /^billing\/transactions\/[0-9a-f-]{36}\/void$/;
const SUBSCRIPTION_CREATE_PATH = "subscriptions";
const SUBSCRIPTION_COMMAND_PATH = /^subscriptions\/[0-9a-f-]{36}\/(activate|renew|supersede|cancel|neutralize|service-grants|pauses|renewal-grace)$/;
const SUBSCRIPTION_NEUTRALIZE_PATH = /^subscriptions\/[0-9a-f-]{36}\/neutralize$/;
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
const WEB_CMS_WRITE = /^web-cms\/slots\/[0-9a-f-]{36}\/(draft|publish|rollback)$/;
const WARD_LEARNER_WRITE = /^pinoria\/ward\/learners\/[0-9a-f-]{36}\/(grants|revocations|loadout)$/;

export async function handleBoWriteRequest(
  request: Request,
  env: BoWriteEnv,
  path: string,
  _legacyKeyResolver?: unknown,
): Promise<Response> {
  try {
    if (request.method !== "POST" && !(request.method === "PATCH" && (WARD_CATALOG_WRITE.test(path) || WARD_SET_WRITE.test(path))) && !(request.method === "PUT" && (WARD_SET_WRITE.test(path) || WARD_LEARNER_WRITE.test(path)))) return json({ error: { code: "PLATFORM_METHOD_NOT_ALLOWED", message: "Method not allowed" } }, 405);
    if (!isAllowedPostPath(path)) return json({ error: { code: "PLATFORM_NOT_FOUND", message: "BO operation not found" } }, 404);

    const credential = await teamCredential(request, env, "BO");

    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    if ((path === BILLING_SALE_PATH || BILLING_TRANSACTION_PATH.test(path) || SUBSCRIPTION_NEUTRALIZE_PATH.test(path) || path === STAFF_ONBOARDING_PATH || path === STUDENT_INTAKE_PATH || path === "delivery/calendar-exclusions" || STUDENT_INTAKE_VOID_PATH.test(path) || path === "delivery/terms" || path === "delivery/term-weeks" || TERM_WEEK_COMMAND.test(path) || TERM_NEUTRALIZE_COMMAND.test(path) || ACQUISITION_INTENT_COMMAND.test(path) || STAFF_REGISTRATION_REVIEW_PATH.test(path) || STAFF_PIN_RESET_PATH.test(path) || LEARNING_OWNER_PATH.test(path) || SESSION_SYLLABUS_BINDING_PATH.test(path) || STUDENT_COMPANION_FEED_PATH.test(path) || isPracticeWritePath(path) || isLearningSyllabusPostPath(path) || WEB_CMS_WRITE.test(path) || TIMEKEEPING_CORRECTION_PATH.test(path) || TIMEKEEPING_MISSED_CHECKOUT_PATH.test(path)) && !idempotencyKey) {
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

    if (STUDENT_COMPANION_FEED_PATH.test(path) && (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body as Record<string, unknown>).length !== 0)) {
      return json({ error: { code: "PLATFORM_INVALID_INPUT", message: "Companion Feed request body must be empty" } }, 400);
    }

    const billingPlanConfig = BILLING_PLAN_CONFIG_PATH.exec(path);
    const coreRequest: BoAccessRequest = billingPlanConfig ? {
      method: "PATCH",
      path: `billing/product-plans/${billingPlanConfig[1]}`,
      body,
    } : {
      method: request.method,
      path,
      body,
      ...(idempotencyKey ? { idempotencyKey } : {}),
    };
    const result = await callBoAccessCoreWithCredential(env.PINO_BO_CORE, coreRequest, credential);
    return json(result.body, result.status, { "x-request-id": result.requestId });
  } catch (error) {
    if (error instanceof TeamAuthError) {
      return json({ error: { code: "IDENTITY_AUTHENTICATION_FAILED", message: error.message } }, error.status);
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
  return path === LEARNING_SYLLABUS_CREATE || LEARNING_SYLLABUS_COMMAND.test(path)
    || LEARNING_SYLLABUS_PROFILE.test(path);
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
    || TIMEKEEPING_CORRECTION_PATH.test(path)
    || TIMEKEEPING_MISSED_CHECKOUT_PATH.test(path)
    || DELIVERY_POST_PATHS.has(path)
    || TERM_WEEK_COMMAND.test(path)
    || TERM_NEUTRALIZE_COMMAND.test(path)
    || DELIVERY_CONFIG_LIFECYCLE.test(path)
    || MATERIALIZATION_PUBLISH.test(path)
    || LEARNING_OWNER_PATH.test(path)
    || SESSION_SYLLABUS_BINDING_PATH.test(path)
    || CALENDAR_EXCLUSION_COMMAND.test(path)
    || PARENT_PIN_PATH.test(path)
    || STUDENT_COMPANION_FEED_PATH.test(path)
    || path === STUDENT_INTAKE_PATH
    || STUDENT_INTAKE_VOID_PATH.test(path)
    || ACQUISITION_INTENT_COMMAND.test(path)
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
    || WARD_LEARNER_WRITE.test(path)
    || path === WARD_SET_MEDIA
    || BILLING_PLAN_CONFIG_PATH.test(path)
    || path === BILLING_SALE_PATH
    || BILLING_TRANSACTION_PATH.test(path)
    || BILLING_BILL_VOID_PATH.test(path)
    || BILLING_TRANSACTION_VOID_PATH.test(path)
    || WEB_CMS_WRITE.test(path);
}

/** Compatibility export for the existing onboarding facade tests/callers. */
export const handleBoStaffOnboardingRequest = handleBoWriteRequest;

function json(body: unknown, status: number, headers: HeadersInit = {}): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}
