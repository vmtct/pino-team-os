import { callBoAccessCoreWithCredential, type BoAccessCoreBinding, type BoAccessRequest } from "./bo-core";
import { teamCredential, TeamAuthError, type TeamAccessEnv } from "./team-auth";

export interface BoReadEnv extends TeamAccessEnv {
  PINO_BO_CORE: BoAccessCoreBinding;
}

const DELIVERY_FUTURE_RESERVATION_POLICY_READ = /^policies\/delivery\/future_reservation\.v1\/(effective|stream)$/;
const OPEN_STUDIO_POLICY_READ = /^policies\/open_studio\/(monthly_path_pass\.v1|bring_a_friend\.v1|public_acquisition\.v1|cancellation\.v1)\/(effective|stream)$/;
const WORKFORCE_POLICY_READ = /^policies\/workforce\/(AVAILABILITY_ELIGIBILITY|TIMEKEEPING_ELIGIBILITY|AVAILABILITY_WINDOW_V1|PLANNING_WINDOW_V1)\/(effective|stream)$/;
const PRACTICE_RESOURCE_READ = /^practice\/resources\/[0-9a-f-]{36}$/;
const WEB_CMS_SLOT_READ = /^web-cms\/slots\/[0-9a-f-]{36}(?:\/history)?$/;
const SESSION_SYLLABUS_BINDING_READ = /^delivery\/sessions\/[0-9a-f-]{36}\/syllabus-binding$/;
const SUBSCRIPTION_PROJECTED_COMPLETION_READ = /^subscriptions\/[0-9a-f-]{36}\/projected-completion$/;
const BILLING_BILL_READ = /^billing\/bills\/[0-9a-f-]{36}$/;
const SPECIALTY_STUDENT_READ = /^specialty\/students\/[0-9a-f-]{36}$/;
const STUDENT_VISIT_DETAIL_READ = /^student-visits\/[0-9a-f-]{36}$/;
const SPECIALTY_POLICY_READ = /^policies\/specialty\/(purchase\.v1|session_settlement\.v1|completion\.v1|reward\.v1)\/(effective|stream)$/;

export async function handleBoOperationalReadRequest(
  request: Request,
  env: BoReadEnv,
  path: string,
  _legacyKeyResolver?: unknown,
): Promise<Response> {
  try {
    if (request.method !== "GET") return json({ error: { code: "PLATFORM_METHOD_NOT_ALLOWED", message: "Method not allowed" } }, 405);
    if (!isOperationalReadPath(path)) return json({ error: { code: "PLATFORM_NOT_FOUND", message: "BO operation not found" } }, 404);
    const credential = await teamCredential(request, env, "BO");
    const url = new URL(request.url);
    const readBody = readQueryBody(path, url);
    const readResource = readQueryResource(path, url);
    const corePath = readCorePath(path, url);
    const result = await callBoAccessCoreWithCredential(env.PINO_BO_CORE, { method: "GET", path: corePath, ...(readResource ? { resource: readResource } : {}), ...(readBody ? { body: readBody } : {}) }, credential);
    return json(result.body, result.status, { "x-request-id": result.requestId });
  } catch (error) {
    if (error instanceof RangeError) return json({ error: { code: "PLATFORM_INVALID_INPUT", message: "Invalid directory filter" } }, 400);
    if (error instanceof TeamAuthError) {
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

export function isStaffRegistrationProtectedReadPath(path: string): boolean {
  return path === "workforce/staff-registration-settings" || path === "workforce/staff-registration-requests";
}

export function isOperationalReadPath(path: string): boolean {
  return path === "subscriptions"
    || path === "billing/product-plans"
    || BILLING_BILL_READ.test(path)
    || path === "specialty/catalog"
    || SPECIALTY_STUDENT_READ.test(path)
    || path === "centers"
    || path === "acquisition/intents"
    || /^acquisition\/intents\/[0-9a-f-]{36}$/.test(path)
    || path === "acquisition/pancake/settings"
    || path === "acquisition/pancake/channels"
    || path === "delivery/bootstrap-state"
    || path === "delivery/calendar-scope"
    || path === "delivery/calendar-exclusions"
    || path === "delivery/calendar-exclusions/preview"
    || path === "path-programs"
    || path === "running-classes"
    || path === "syllabi"
    || path === "learning/syllabi"
    || path === "learning/syllabi/owners"
    || path === "learning/syllabi/media"
    || /^learning\/syllabi\/[0-9a-f-]{36}$/.test(path)
    || /^learning\/syllabi\/versions\/[0-9a-f-]{36}\/(artchitect-profile|pianohouse-profile|little-piner-profile)$/.test(path)
    || path === "sessions"
    || SESSION_SYLLABUS_BINDING_READ.test(path)
    || path === "tv/displays"
    || path === "tv/devices"
    || path === "access/roles"
    || path === "access/permissions"
    || path === "access/audit"
    || path === "access/users"
    || path === "workforce/staff-records"
    || path === "workforce/timekeeping"
    || path === "workforce/timekeeping/centers"
    || path === "workforce/staff-registration-settings"
    || path === "workforce/staff-registration-requests"
    || path === "pinoria/effects/catalog"
    || path === "pinoria/ward/catalog"
    || path === "pinoria/ward/sets"
    || path === "pinoria/ward/learners"
    || /^pinoria\/ward\/learners\/[0-9a-f-]{36}(?:\/accessories)?$/.test(path)
    || path === "pinoria/ward/set-webm-assets"
    || path === "pinoria/worlds"
    || path === "pinoria/worlds/instances"
    || path === "pinoria/worlds/learners"
    || /^pinoria\/worlds\/learners\/[0-9a-f-]{36}$/.test(path)
    || /^pinoria\/worlds\/instances\/[0-9a-f-]{36}$/.test(path)
    || /^pinoria\/worlds\/students\/[0-9a-f-]{36}\/live$/.test(path)
    || path === "pinoria/onboarding/sets"
    || /^pinoria\/onboarding\/(students|staff)\/[0-9a-f-]{36}$/.test(path)
    || path === "web-cms/slots"
    || WEB_CMS_SLOT_READ.test(path)
    || path === "learners"
    || path === "student-visits"
    || STUDENT_VISIT_DETAIL_READ.test(path)
    || path === "identity/parents"
    || path === "practice/authoring-context"
    || path === "practice/repertoire-access/context"
    || path === "practice/repertoire-access"
    || path === "practice/resources"
    || PRACTICE_RESOURCE_READ.test(path)
    || path === "open-studio/operations"
    || path === "open-studio/listing-catalog"
    || path === "open-studio/learners"
    || path === "open-studio/passes"
    || DELIVERY_FUTURE_RESERVATION_POLICY_READ.test(path)
    || SPECIALTY_POLICY_READ.test(path)
    || OPEN_STUDIO_POLICY_READ.test(path)
    || WORKFORCE_POLICY_READ.test(path)
    || /^open-studio\/passes\/[0-9a-f-]{36}\/claim-eligibility$/.test(path)
    || /^open-studio\/students\/[0-9a-f-]{36}\/lifecycle$/.test(path)
    || /^students\/[0-9a-f-]{36}\/lifecycle$/.test(path)
    || /^students\/[0-9a-f-]{36}\/pinoria$/.test(path)
    || SUBSCRIPTION_PROJECTED_COMPLETION_READ.test(path)
    || /^access\/roles\/[0-9a-f-]{36}$/.test(path)
    || /^workforce\/staff-records\/[0-9a-f-]{36}(?:\/(?:pinoria|private))?$/.test(path)
    || /^sessions\/[0-9a-f-]+\/registrations$/.test(path)
    || /^sessions\/[0-9a-f-]{36}\/learning-owner$/.test(path);
}

function readCorePath(path: string, url: URL): string {
  if (path === "web-cms/slots") {
    const params = new URLSearchParams();
    for (const key of ["site", "page", "includeRetired"] as const) { const value = url.searchParams.get(key); if (value !== null) params.set(key, value); }
    const query = params.toString();
    return query ? `${path}?${query}` : path;
  }
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

function readQueryResource(path: string, url: URL): BoAccessRequest["resource"] | undefined {
  if (path === "learners" || path === "open-studio/learners" || path === "student-visits" || STUDENT_VISIT_DETAIL_READ.test(path) || /^(?:open-studio\/)?students\/[0-9a-f-]{36}\/lifecycle$/.test(path)) {
    const centerId = url.searchParams.get("centerId")?.trim();
    return centerId ? { centerId } : undefined;
  }
  return undefined;
}

function readQueryBody(path: string, url: URL): Record<string, unknown> | undefined {
  if (path === "subscriptions") { const result:Record<string,unknown>={}; for(const key of ["query","lifecycle","pathProgramId","centerId","beforeCreatedAt","beforeSubscriptionId"]){ const value=url.searchParams.get(key); if(value!==null&&value!=="")result[key]=value; } const limit=url.searchParams.get("limit"); if(limit!==null&&/^\d+$/.test(limit))result.limit=Number(limit); return result; }
  if (path === "pinoria/worlds/instances") {
    const permitted=["query","worldId","status","limit","offset","sortKey","sortDirection"];
    for(const key of url.searchParams.keys()) if(!permitted.includes(key)) throw new RangeError("Invalid World instance directory query key");
    const body:Record<string,unknown>={};
    for(const key of ["query","worldId","status","sortKey","sortDirection"]) {
      const value=url.searchParams.get(key);
      if(value!==null && value!=="") body[key]=value;
    }
    for(const key of ["limit","offset"]) {
      const value=url.searchParams.get(key);
      if(value!==null) {
        if(!/^(?:0|[1-9][0-9]*)$/.test(value)) throw new RangeError("Invalid directory page");
        body[key]=Number(value);
      }
    }
    if(body.limit!==undefined && ((body.limit as number)<1||(body.limit as number)>100)) throw new RangeError("Invalid directory limit");
    if(body.status && !["LIVE","INACTIVE","REVOKED"].includes(String(body.status))) throw new RangeError("Invalid directory status");
    if(body.sortKey && !["grantedAt","studentName","worldName","status","label"].includes(String(body.sortKey))) throw new RangeError("Invalid directory sort key");
    if(body.sortDirection && !["ASC","DESC"].includes(String(body.sortDirection))) throw new RangeError("Invalid directory sort direction");
    return body;
  }

  if (path === "student-visits" || STUDENT_VISIT_DETAIL_READ.test(path)) {
    const body: Record<string, unknown> = {};
    for (const key of ["centerId", "studentProfileId", "query", "status", "startAt", "endBefore", "sort", "order"] as const) {
      const value = url.searchParams.get(key);
      if (value !== null && value !== "") body[key] = value;
    }
    for (const key of ["limit", "offset"] as const) {
      const value = url.searchParams.get(key);
      if (value !== null && value !== "") body[key] = Number(value);
    }
    return body;
  }
  if (/^pinoria\/onboarding\/(students|staff)\/[0-9a-f-]{36}$/.test(path)) {
    const centerId = url.searchParams.get("centerId")?.trim();
    return centerId ? { centerId } : undefined;
  }
  if (/^workforce\/staff-records\/[0-9a-f-]{36}\/private$/.test(path)) {
    const centerId = url.searchParams.get("centerId")?.trim();
    return centerId ? { centerId } : undefined;
  }
  if (path === "acquisition/intents") {
    const body: Record<string, unknown> = {};
    const status = url.searchParams.get("status");
    const limit = url.searchParams.get("limit");
    if (status) body.status = status;
    if (limit) body.limit = Number(limit);
    return Object.keys(body).length ? body : undefined;
  }
  if (path === "workforce/timekeeping") {
    const body: Record<string, unknown> = {};
    for (const key of ["centerId", "workDate", "startDate", "endDate", "staffMemberId", "status", "cursor"] as const) { const value = url.searchParams.get(key); if (value) body[key] = value; }
    const limit = url.searchParams.get("limit");
    const offset = url.searchParams.get("offset");
    if (limit) body.limit = Number(limit);
    if (offset) body.offset = Number(offset);
    return body;
  }
  if (path === "delivery/calendar-exclusions" || path === "delivery/calendar-exclusions/preview") {
    const body: Record<string, unknown> = {};
    for (const key of ["centerId", "status", "scopeType", "pathProgramId", "runningClassId", "startsOnLocalDate", "endsBeforeLocalDate", "effectiveAt"] as const) {
      const value = url.searchParams.get(key);
      if (value !== null && value !== "") body[key] = value;
    }
    return Object.keys(body).length ? body : undefined;
  }
  if (path === "specialty/catalog") {
    const pathProgramId = url.searchParams.get("pathProgramId")?.trim();
    return pathProgramId ? { pathProgramId } : undefined;
  }
  if (path === "access/audit") {
    const body: Record<string, unknown> = {};
    const limit = url.searchParams.get("limit");
    const offset = url.searchParams.get("offset");
    const query = url.searchParams.get("query");
    const outcome = url.searchParams.get("outcome");
    if (limit) body.limit = Number(limit);
    if (offset) body.offset = Number(offset);
    if (query) body.query = query;
    if (outcome) body.outcome = outcome;
    return Object.keys(body).length ? body : undefined;
  }
  if (path === "identity/parents") return {
    ...(url.searchParams.get("query") ? { query: url.searchParams.get("query")! } : {}),
    ...(url.searchParams.get("limit") ? { limit: Number(url.searchParams.get("limit")) } : {}),
  };
  if (path === "learners" || path === "open-studio/learners") return {
    ...(url.searchParams.get("query") ? { query: url.searchParams.get("query")! } : {}),
    ...(url.searchParams.get("limit") ? { limit: Number(url.searchParams.get("limit")) } : {}),
    ...(url.searchParams.get("offset") ? { offset: Number(url.searchParams.get("offset")) } : {}),
  };
  if (SUBSCRIPTION_PROJECTED_COMPLETION_READ.test(path)) return { effectiveAt: url.searchParams.get("effectiveAt") };
  if (path === "open-studio/operations") return url.searchParams.get("centerId") ? { centerId: url.searchParams.get("centerId")! } : undefined;
  if (path === "open-studio/listing-catalog") return { ...(url.searchParams.get("centerId") ? { centerId: url.searchParams.get("centerId")! } : {}), ...(url.searchParams.get("effectiveAt") ? { effectiveAt: url.searchParams.get("effectiveAt")! } : {}) };
  if (path === "open-studio/passes") return { houseMembershipId: url.searchParams.get("houseMembershipId"), effectiveAt: url.searchParams.get("effectiveAt") };
  if (/^open-studio\/passes\/[0-9a-f-]{36}\/claim-eligibility$/.test(path)) return {
    listingId: url.searchParams.get("listingId"), participantMode: url.searchParams.get("participantMode"),
    studentProfileId: url.searchParams.get("studentProfileId"), effectiveAt: url.searchParams.get("effectiveAt"),
  };
  if (DELIVERY_FUTURE_RESERVATION_POLICY_READ.test(path) || SPECIALTY_POLICY_READ.test(path) || OPEN_STUDIO_POLICY_READ.test(path) || WORKFORCE_POLICY_READ.test(path)) {
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
