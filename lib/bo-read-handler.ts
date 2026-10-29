import { authorizeHoShell, type HoEnv } from "./ho-auth";
import { BoShellGateError } from "./bo-shell-gate";
import { HO_STAGING_HOSTNAME } from "./host-boundary";
import { hoAccessReadAllowed, validateHoAuditQuery, projectHoAuditResponse } from "./ho-access-guard";
import {validateHoA1Query} from "./ho-a1-query";
import { callBoAccessCoreWithCredential, type BoAccessCoreBinding, type BoAccessRequest } from "./bo-core";
import { teamCredential, TeamAuthError, type TeamAccessEnv } from "./team-auth";
import { boPublicViewCoreRoute } from "./bo-public-view-route-guard";

export interface BoReadEnv extends TeamAccessEnv {
  APP_ENV?: string; HO_PILOT_FOUNDER_USER_IDS?: string;
  PINO_BO_CORE: BoAccessCoreBinding;
}

const DELIVERY_FUTURE_RESERVATION_POLICY_READ = /^policies\/delivery\/future_reservation\.v1\/(effective|stream)$/;
const OPEN_STUDIO_POLICY_READ = /^policies\/open_studio\/(monthly_path_pass\.v1|bring_a_friend\.v1|public_acquisition\.v1|cancellation\.v1)\/(effective|stream)$/;
const WORKFORCE_POLICY_READ = /^policies\/workforce\/(AVAILABILITY_ELIGIBILITY|TIMEKEEPING_ELIGIBILITY|AVAILABILITY_WINDOW_V1|PLANNING_WINDOW_V1)\/(effective|stream)$/;
const PRACTICE_RESOURCE_READ = /^practice\/resources\/[0-9a-f-]{36}$/;
const TV_POLICY_READ = new Set(["pinoria/tv-config/policy/head","pinoria/tv-config/policy/versions","pinoria/tv-config/policy/version","pinoria/tv-config/policy/active"]);
const MISSION_CATALOG_READ = /^learning\/missions(?:\/[0-9a-f-]{36})?$/;
const TV_DIALOGUE_CONFIG_READ = new Set(["pinoria/tv-config/dialogue/head","pinoria/tv-config/dialogue/versions","pinoria/tv-config/dialogue/version","pinoria/tv-config/dialogue/active"]);
const TV_SPATIAL_CONFIG_READ = new Set(["pinoria/tv-config/spatial/head","pinoria/tv-config/spatial/versions","pinoria/tv-config/spatial/version","pinoria/tv-config/spatial/active"]);
const WEB_CMS_SLOT_READ = /^web-cms\/slots\/[0-9a-f-]{36}(?:\/history)?$/;
const SESSION_SYLLABUS_BINDING_READ = /^delivery\/sessions\/[0-9a-f-]{36}\/syllabus-binding$/;
const SUBSCRIPTION_PROJECTED_COMPLETION_READ = /^subscriptions\/[0-9a-f-]{36}\/projected-completion$/;
// PAP-1035: Enrollment read routes explicitly admitted after FC E2E found
// BFF 404 before Core. No wildcard write/read admission.
const S3_SUBSCRIPTION_READ = /^subscriptions\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:\/(?:enrollments|placement))?$/;
const S3_ENROLLMENT_RECORD_READ = /^enrollments\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const S3_ENROLLMENT_CAPACITY_READ = "enrollments/capacity";
const S3_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const S3_LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;

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
    if (new URL(request.url).hostname === HO_STAGING_HOSTNAME) {
      if (!hoAccessReadAllowed(path)) return json({ error: { code: "PLATFORM_NOT_FOUND" } }, 404);
      await authorizeHoShell(request.headers, env as HoEnv);
      const auditRead = path === "access/audit";
      if (auditRead) validateHoAuditQuery(new URL(request.url).searchParams);
      validateHoA1Query(path,new URL(request.url).searchParams);
    }
    const credential = await teamCredential(request, env, "BO");
    const url = new URL(request.url);
    const readBody = readQueryBody(path, url);
    const readResource = readQueryResource(path, url);
    const corePath = readCorePath(path, url);
    const result = await callBoAccessCoreWithCredential(env.PINO_BO_CORE, { method: "GET", path: corePath, ...(readResource ? { resource: readResource } : {}), ...(readBody ? { body: readBody } : {}) }, credential);
    return json(url.hostname === HO_STAGING_HOSTNAME && path === "access/audit" && result.status === 200 ? projectHoAuditResponse(result.body) : result.body, result.status, { "x-request-id": result.requestId });
  } catch (error) {
    if (error instanceof BoShellGateError) return json({ error: { code: "HO_ACCESS_DENIED", message: error.message } }, error.status);
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

export function isStaffCompensationPath(path: string): boolean {
  const p=path.split("/");
  return (p.length===5||p.length===6) && p[0]==="workforce" && p[1]==="staff-records"
    && /^[0-9a-f-]{36}$/.test(p[2]??"") && p[3]==="private" && p[4]==="compensation"
    && (p.length===5||/^[0-9a-f-]{36}$/.test(p[5]??""));
}

const RUNNING_CLASS_ENROLLMENT_READ = /^delivery\/running-classes\/[0-9a-f-]{36}\/enrollments$/;

export function isOperationalReadPath(path: string): boolean {
  return path === "audit/subject"
    || path === "subscriptions"
    || S3_SUBSCRIPTION_READ.test(path)
    || S3_ENROLLMENT_RECORD_READ.test(path)
    || path === S3_ENROLLMENT_CAPACITY_READ
    || path === "billing/product-plans"
    || BILLING_BILL_READ.test(path)
    || path === "specialty/catalog"
    || SPECIALTY_STUDENT_READ.test(path)
    || path === "centers"
    || path === "acquisition/intents"
    || /^acquisition\/intents\/[0-9a-f-]{36}$/.test(path)
    || path === "acquisition/pancake/settings"
    || path === "acquisition/pancake/channels"
    || RUNNING_CLASS_ENROLLMENT_READ.test(path)
    || path === "delivery/bootstrap-state"
    || path === "delivery/calendar-scope"
    || path === "delivery/calendar-exclusions"
    || path === "delivery/calendar-exclusions/preview"
    || path === "path-programs"
    || Boolean(boPublicViewCoreRoute(path, "GET"))
    || path === "running-classes"
    || path === "syllabi"
    || path === "learning/syllabi"
    || MISSION_CATALOG_READ.test(path)
    || TV_POLICY_READ.has(path)
    || path === "learning/syllabi/owners"
    || path === "learning/syllabi/media"
    || /^learning\/syllabi\/[0-9a-f-]{36}$/.test(path)
    || /^learning\/syllabi\/versions\/[0-9a-f-]{36}\/(artchitect-profile|pianohouse-profile|little-piner-profile)$/.test(path)
    || path === "sessions"
    || /^sessions\/[0-9a-f-]{36}\/roster$/.test(path)
    || SESSION_SYLLABUS_BINDING_READ.test(path)
    || path === "tv/displays"
    || path === "tv/devices"
    || path === "access/roles"
    || /^access\/roles\/[0-9a-f-]{36}$/.test(path)
    || path === "access/permissions"
    || path === "access/audit"
    || path === "access/users"
    || path === "workforce/staff-records"
    || (isStaffCompensationPath(path) && path.split("/").length===5)
    || path === "workforce/timekeeping"
    || path === "workforce/timekeeping/centers"
    || path === "workforce/staff-registration-settings"
    || path === "workforce/staff-registration-requests"
    || TV_SPATIAL_CONFIG_READ.has(path) || TV_DIALOGUE_CONFIG_READ.has(path)
    || path === "pinoria/avatars"
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
    || path === "identity/parents/directory"
    || /^identity\/parents\/[0-9a-f-]{36}\/detail$/.test(path)
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
  if (path === "learning/missions") {
    // Core parses the Mission catalog filters from the request path, not the
    // BO facade resource. Strip caller-controlled user/permission fields.
    const params = new URLSearchParams();
    for (const key of ["search", "status", "level", "pathProgramId", "limit", "offset"] as const) {
      const value = url.searchParams.get(key);
      if (value !== null) params.set(key, value);
    }
    const query = params.toString();
    return query ? path + "?" + query : path;
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
  // PAP-982: resource scope is a selected CENTER reauthorized by Core, not a client grant.
  if (path === "pinoria/avatars") {
    const centerId = url.searchParams.get("centerId");
    return centerId ? { centerId } : undefined;
  }
  // The Core delivery bootstrap accepts an explicit Center resource. Do not
  // invent GLOBAL access for Manager or forward caller-supplied principal fields.
  if (path === "delivery/bootstrap-state" || path === "delivery/calendar-scope") {
    const centers = url.searchParams.getAll("centerId");
    if (centers.length > 1) throw new RangeError("Ambiguous Center");
    const centerId = centers[0]?.trim();
    if (centerId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(centerId)) {
      throw new RangeError("Invalid Center");
    }
    return centerId ? { centerId } : undefined;
  }
  if (isStaffCompensationPath(path)) {
    const centerId=url.searchParams.get("centerId")?.trim();
    return centerId?{centerId}:undefined;
  }
  if (path === "learners" || path === "open-studio/learners" || path === "student-visits" || STUDENT_VISIT_DETAIL_READ.test(path) || /^(?:open-studio\/)?students\/[0-9a-f-]{36}\/lifecycle$/.test(path)) {
    const centerId = url.searchParams.get("centerId")?.trim();
    return centerId ? { centerId } : undefined;
  }
  return undefined;
}

export function readQueryBody(path: string, url: URL): Record<string, unknown> | undefined {
  if (path === "pinoria/avatars") {
    const allowed = new Set(["centerId","limit","cursor","q","subjectType","avatarStatus","subjectStatus"]);
    for (const key of url.searchParams.keys()) {
      if (!allowed.has(key) || url.searchParams.getAll(key).length !== 1) throw new RangeError("Invalid Self Directory query field");
    }
    const centerId = url.searchParams.get("centerId");
    if (centerId !== null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(centerId)) throw new RangeError("Invalid Self Directory Center");
    const body: Record<string, unknown> = {};
    const n = url.searchParams.get("limit");
    if (n !== null) {
      if (!/^[1-9][0-9]*$/.test(n) || !Number.isSafeInteger(Number(n)) || Number(n)>100) throw new RangeError("Invalid Self Directory limit");
      body.limit=Number(n);
    }
    for (const key of ["cursor","q","subjectType","avatarStatus","subjectStatus"] as const) {
      const v=url.searchParams.get(key);
      if (v !== null) body[key]=v;
    }
    if (typeof body.cursor === "string" && (!body.cursor.length || body.cursor.length>4096)) throw new RangeError("Invalid Self Directory cursor");
    if (typeof body.q === "string" && (body.q.length>120 || [...body.q].some(c => c.charCodeAt(0)<32 || c.charCodeAt(0)===127))) throw new RangeError("Invalid Self Directory search");
    if (body.subjectType !== undefined && !["ALL","STAFF","LEARNER"].includes(String(body.subjectType))) throw new RangeError("Invalid Self Directory role");
    if (body.avatarStatus !== undefined && !["ALL","IDENTITY_UNLINKED","SELF_MISSING","NEEDS_REPAIR","NOT_STARTED","IN_PROGRESS","READY"].includes(String(body.avatarStatus))) throw new RangeError("Invalid Self Directory avatar status");
    if (body.subjectStatus !== undefined && !["ALL","ACTIVE","INACTIVE","ARCHIVED","MIXED"].includes(String(body.subjectStatus))) throw new RangeError("Invalid Self Directory subject status");
    return Object.keys(body).length?body:undefined;
  }
  if (RUNNING_CLASS_ENROLLMENT_READ.test(path)) {
    for (const key of url.searchParams.keys()) {
      if (!["limit","beforeFrom","beforeId","beforeRank","asOfLocalDate"].includes(key) || url.searchParams.getAll(key).length !== 1)
        throw new RangeError("Invalid Running Class Enrollment query");
    }
    const n=url.searchParams.get("limit")??"50";
    const limit=Number(n),beforeFrom=url.searchParams.get("beforeFrom"),beforeId=url.searchParams.get("beforeId"),beforeRank=url.searchParams.get("beforeRank"),asOfLocalDate=url.searchParams.get("asOfLocalDate");
    const completeCursor=[beforeFrom,beforeId,beforeRank,asOfLocalDate].every(value=>value===null)||[beforeFrom,beforeId,beforeRank,asOfLocalDate].every(value=>value!==null);
    if (!/^[0-9]+$/.test(n)||!Number.isSafeInteger(limit)||limit<1||limit>100||
        !completeCursor||
        (beforeRank!==null&&(!/^[012]$/.test(beforeRank)))||
        (asOfLocalDate!==null&&!/^\d{4}-\d{2}-\d{2}$/.test(asOfLocalDate))||
        (beforeFrom!==null&&!/^\d{4}-\d{2}-\d{2}$/.test(beforeFrom))||
        (beforeId!==null&&!/^[0-9a-f-]{36}$/.test(beforeId)))
      throw new RangeError("Invalid Running Class Enrollment cursor or limit");
    return {limit,...(beforeFrom===null?{}:{beforeFrom,beforeId,beforeRank:Number(beforeRank),asOfLocalDate})};
  }
  if (path === "audit/subject") {
    const allowed = ["subject_type", "subject_id", "query", "cursor", "limit"];
    for (const key of url.searchParams.keys()) {
      if (!allowed.includes(key) || url.searchParams.getAll(key).length !== 1) throw new RangeError("Invalid audit query");
    }
    const type = url.searchParams.get("subject_type"), id = url.searchParams.get("subject_id");
    const query = url.searchParams.get("query") ?? "", cursor = url.searchParams.get("cursor");
    const limitText = url.searchParams.get("limit") ?? "50", limit = Number(limitText);
    if (!(type === "student_profile" || type === "running_class" || type === "subscription")
      || !id || !/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)
      || query.length > 120 || [...query].some(c => c.charCodeAt(0) < 32)
      || !/^[0-9]+$/.test(limitText) || !Number.isSafeInteger(limit) || limit < 1 || limit > 50
      || (cursor !== null && (cursor.length === 0 || cursor.length > 2048))) throw new RangeError("Invalid audit query");
    return { subject_type: type, subject_id: id, query, cursor, limit };
  }
  if (TV_SPATIAL_CONFIG_READ.has(path) || TV_DIALOGUE_CONFIG_READ.has(path) || TV_POLICY_READ.has(path)) {
    const supported = path.endsWith("/active") ? ["centerId"] : path.endsWith("/version") ? ["scope","centerId","versionId"] : ["scope","centerId"];
    for (const key of url.searchParams.keys()) if (!supported.includes(key)) throw new RangeError("Unknown spatial config query key");
    const centerId = url.searchParams.get("centerId")?.trim();
    if (path.endsWith("/active")) {
      if (!centerId) throw new RangeError("centerId is required");
      return { centerId };
    }
    const kind = url.searchParams.get("scope");
    if (kind !== "DEFAULT" && kind !== "CENTER") throw new RangeError("Invalid spatial config scope");
    if (kind === "DEFAULT" && centerId) throw new RangeError("Unexpected Center on default scope");
    if (kind === "CENTER" && !centerId) throw new RangeError("Center scope requires centerId");
    const body: Record<string, unknown> = { scope: kind === "DEFAULT" ? {kind:"DEFAULT"} : {kind:"CENTER",centerId} };
    if (path.endsWith("/version")) {
      const versionId = url.searchParams.get("versionId")?.trim();
      if (!versionId) throw new RangeError("versionId is required");
      body.versionId = versionId;
    }
    return body;
  }
  if (S3_SUBSCRIPTION_READ.test(path) || S3_ENROLLMENT_RECORD_READ.test(path) || path === S3_ENROLLMENT_CAPACITY_READ) {
    const params = url.searchParams;
    const placement = path.endsWith("/placement");
    const capacity = path === S3_ENROLLMENT_CAPACITY_READ;
    const allowed = capacity
      ? new Set(["runningClassId","targetLocalDate","subscriptionId","plannedEntryLocalTime","plannedDurationMinutes"])
      : placement ? new Set(["targetLocalDate"]) : new Set<string>();
    for (const key of params.keys()) {
      if (!allowed.has(key) || params.getAll(key).length !== 1) throw new RangeError("Invalid S3 Enrollment query key");
    }
    if (!placement && !capacity) return undefined;
    const targetLocalDate = params.get("targetLocalDate");
    if (!targetLocalDate || !S3_LOCAL_DATE.test(targetLocalDate) ||
        Number.isNaN(Date.parse(targetLocalDate+"T00:00:00Z")) ||
        new Date(targetLocalDate+"T00:00:00Z").toISOString().slice(0,10)!==targetLocalDate) {
      throw new RangeError("Invalid targetLocalDate");
    }
    if (placement) return {targetLocalDate};
    const runningClassId = params.get("runningClassId");
    if (!runningClassId || !S3_UUID.test(runningClassId)) throw new RangeError("Invalid runningClassId");
    const body:Record<string,unknown> = {runningClassId,targetLocalDate};
    const subscriptionId = params.get("subscriptionId");
    if (subscriptionId !== null) {
      if (!S3_UUID.test(subscriptionId)) throw new RangeError("Invalid subscriptionId");
      body.subscriptionId = subscriptionId;
    }
    const plannedEntryLocalTime = params.get("plannedEntryLocalTime");
    if (plannedEntryLocalTime !== null) {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(plannedEntryLocalTime)) throw new RangeError("Invalid plannedEntryLocalTime");
      body.plannedEntryLocalTime = plannedEntryLocalTime;
    }
    const duration = params.get("plannedDurationMinutes");
    if (duration !== null) {
      if (!/^[1-9]\d*$/.test(duration) || !Number.isSafeInteger(Number(duration)) || Number(duration)>1440) throw new RangeError("Invalid plannedDurationMinutes");
      body.plannedDurationMinutes = Number(duration);
    }
    return body;
  }
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
  if (path === "identity/parents/directory") {
    // Only normalized, unique numeric pagination reaches the authorized Core read.
    // Never silently ignore unknown/duplicate filters on a private PII directory.
    const allowed = new Set(["limit", "offset"]);
    for (const key of url.searchParams.keys()) {
      if (!allowed.has(key) || url.searchParams.getAll(key).length !== 1) {
        throw new RangeError("Invalid Parent Directory query");
      }
    }
    const pageNumber = (key: "limit" | "offset", min: number, max: number) => {
      const value = url.searchParams.get(key);
      if (value === null) return undefined;
      if (!/^(?:0|[1-9][0-9]*)$/.test(value)) throw new RangeError("Invalid Parent Directory page");
      const number = Number(value);
      if (!Number.isSafeInteger(number) || number < min || number > max) {
        throw new RangeError("Invalid Parent Directory page");
      }
      return number;
    };
    const limit = pageNumber("limit", 1, 100);
    const offset = pageNumber("offset", 0, 10000);
    return { ...(limit === undefined ? {} : { limit }), ...(offset === undefined ? {} : { offset }) };
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
