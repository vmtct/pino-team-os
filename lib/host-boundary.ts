import {tosV4StagingHost} from "./tos-v4-staging-host";
import { HO_PAGE_PATHS, HO_HOME_PATH } from "./ho-routes";
export const HO_STAGING_HOSTNAME = "ho.staging.pinohouse.art";
export const TOS_HOSTNAME = "tos.pinohouse.art";
export const BO_HOSTNAME = "bo.pinohouse.art";
export const TOS_STAGING_HOSTNAME = "tos.staging.pinohouse.art";
export const BO_STAGING_HOSTNAME = "bo.staging.pinohouse.art";
export function isBoHostname(host: string): boolean {
  const normalized = normalizeHostname(host);
  return normalized === BO_HOSTNAME || normalized === BO_STAGING_HOSTNAME;
}
export const STAFF_REGISTRATION_HOSTNAME = "join.pinohouse.art";
export const RETIRED_TEAM_HOSTNAME = "team.pinohouse.art";

export type HostBoundaryDecision =
  | { action: "next" }
  | { action: "redirect"; pathname: "/bo" | "/ho" | "/tos-v4" | typeof HO_HOME_PATH }
  | { action: "not_found" };

export function decideHostBoundary(host: string, pathname: string, method = "GET"): HostBoundaryDecision {
  const hostname = normalizeHostname(host);

  if (hostname === HO_STAGING_HOSTNAME) {
    const p = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
    // PAP-1207: exact HO GLOBAL MissionDefinition writer only; Core rechecks GLOBAL Founder.
    if (p === "/api/ho/learning/missions") return { action: method === "POST" ? "next" : "not_found" };
    if (/^\/api\/ho\/learning\/missions\/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(p))
      return { action: (method === "PUT" || method === "GET") ? "next" : "not_found" };
    const staffRateWrite = /^\/api\/ho\/staff\/[0-9a-f-]{36}\/compensation$/.test(p);
    const staffRateCorrection = /^\/api\/ho\/staff\/[0-9a-f-]{36}\/compensation\/[0-9a-f-]{36}$/.test(p);
    const staffPasswordReset = /^\/api\/ho\/staff\/[0-9a-f-]{36}\/password-reset$/.test(p);
    const staffRoleWrite = /^\/api\/ho\/staff\/[0-9a-f-]{36}\/role$/.test(p);
    const hoRoleDefinitionWrite = /^\/api\/ho\/system\/roles\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/update$/i.test(p);
    if (method === "POST" && (staffRoleWrite || hoRoleDefinitionWrite)) return { action: "next" };
    if (method === "POST" && staffPasswordReset) return { action: "next" };
    if ((method === "GET" || method === "POST") && staffRateWrite) return { action: "next" };
    // PAP-996: distinct Founder-only, HO Staging-only PATCH for a single immutable rate-row identity.
    if (method === "PATCH" && staffRateCorrection) return { action: "next" };
    // PAP-1092: exact HO one-use Pass routes, Founder pilot + Core GLOBAL permission.
    if (p === "/api/ho/open-studio/walkin/inventory" && method === "GET") return { action: "next" };
    if (["/api/ho/open-studio/walkin/batches", "/api/ho/open-studio/walkin/revoke"].includes(p) && method === "POST") return { action: "next" };
    const authPost = ["/api/staff-auth/login", "/api/staff-auth/logout", "/api/staff-auth/change-password"].includes(p);
    if (method === "POST" && authPost) return { action: "next" };
    // PAP-1126: exact HO Item paths AND verbs, never a generic HO write aperture.
    const itemBase = p === "/api/ho/pinoria/items";
    const itemUpload = p === "/api/ho/pinoria/items/uploads";
    const itemRecord = /^\/api\/ho\/pinoria\/items\/[0-9a-f-]{36}$/.test(p);
    const itemPublish = /^\/api\/ho\/pinoria\/items\/[0-9a-f-]{36}\/(?:publish|unpublish)$/.test(p);
    const itemMedia = /^\/api\/ho\/pinoria\/items\/[0-9a-f-]{36}\/(?:media|draft-media)$/.test(p);
    if (itemBase || itemUpload || itemRecord || itemPublish || itemMedia) {
      const allowed = (itemBase && (method === "GET" || method === "POST"))
        || (itemUpload && method === "POST")
        || (itemRecord && (method === "GET" || method === "PATCH"))
        || (itemPublish && method === "POST")
        || (itemMedia && method === "GET");
      return allowed ? { action:"next" } : { action:"not_found" };
    }
    if (method !== "GET" && method !== "HEAD") return { action: "not_found" };
    if (p.startsWith("/api/") && method !== "GET") return { action: "not_found" };
    if (p === "/") return { action: "redirect", pathname: HO_HOME_PATH };
    if (["/api/bo/workforce/staff-records", "/ho", ...Object.values(HO_PAGE_PATHS), "/staff-login", "/staff-password/change", "/api/staff-auth/status", "/api/bo/context", "/api/bo/centers", "/api/bo/access/users", "/api/bo/access/roles", "/api/bo/access/permissions", "/api/bo/access/audit", "/api/bo/learning/syllabi", "/api/bo/learning/syllabi/owners", "/api/bo/learning/missions", "/api/bo/pinoria/worlds", "/api/bo/pinoria/ward/catalog", "/api/bo/pinoria/ward/sets", "/api/bo/pinoria/effects/catalog", "/favicon.ico"].includes(p) || /^\/api\/bo\/access\/roles\/[0-9a-f-]{36}$/.test(p) || /^\/api\/bo\/(?:learning\/syllabi|learning\/missions)\/[0-9a-f-]{36}$/.test(p) || isFrameworkAsset(p) || p === "/bo-skeleton/ho-scoped.css") return { action: "next" };
    return { action: "not_found" };
  }
  if (isPathWithin(pathname, "/tos-v4") && !tosV4StagingHost(hostname)) return { action: "not_found" };
  // HO never leaks through BO/TOS, production, workers.dev, localhost or unknown hosts.
  if (isPathWithin(pathname, "/ho") || isPathWithin(pathname, "/api/ho") || isPathWithin(pathname, "/prototype")) return { action: "not_found" };
  if (hostname === RETIRED_TEAM_HOSTNAME) return { action: "not_found" };

  if (hostname === STAFF_REGISTRATION_HOSTNAME) {
    const normalized = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
    if (normalized === "/staff/register" || normalized === "/api/staff-registration" || normalized === "/favicon.ico" || isFrameworkAsset(normalized)) return { action: "next" };
    return { action: "not_found" };
  }

  if (isStaffRegistrationPath(pathname) && !isLocalOrPreviewHostname(hostname)) return { action: "not_found" };

  if (hostname === BO_HOSTNAME || hostname === BO_STAGING_HOSTNAME) {
    // PAP-1220: exact Classroom Diary Center read-only module and bounded Core facade,
    // Staging BO only. BFF independently checks credentials/query; Core authorizes Center + Path.
    // No HO GLOBAL, no writes, no Production exposure, no arbitrary Diary child/media route.
    if (pathname === "/bo/classroom-diaries") {
      return hostname === BO_STAGING_HOSTNAME && (method === "GET" || method === "HEAD")
        ? { action: "next" } : { action: "not_found" };
    }
    if (/^\/api\/bo\/learning\/path-diaries(?:\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?$/i.test(pathname)) {
      return hostname === BO_STAGING_HOSTNAME && method === "GET"
        ? { action: "next" } : { action: "not_found" };
    }
    // PAP-1224: new Pass TDD is BO Staging-only; production retains legacy Open Studio.
    if (pathname === "/bo/open-studio-passes") return (method==="GET"||method==="HEAD") ? {action:"next"} : {action:"not_found"};
    // PAP-1211: one exact synthetic salary adjustment E2E path, Founder BFF guarded.
    // Never allow this route on Production/HO/TOS or for other payment subjects.
    const salaryE2EAdjustment="/api/bo/workforce/payroll/periods/01a171ed-eb78-7941-b1de-dd4c020457b7/staff/01a18a28-6d8e-7db7-acbb-a18a942a5e72/adjustments";
    if (pathname === salaryE2EAdjustment) {
      return hostname === BO_STAGING_HOSTNAME && (method === "GET" || method === "POST")
        ? { action: "next" } : { action: "not_found" };
    }
    // PAP-1125: exact Shift Plan creation admission; Core still enforces BO identity, Center grant, idempotency and version.
    // Keep non-POST verbs denied at the host edge rather than expanding the generic BO route allowlist.
    if (pathname === "/bo/pinoria-avatars") {
      return hostname === BO_STAGING_HOSTNAME && (method === "GET" || method === "HEAD") ? { action: "next" } : { action: "not_found" };
    }
    if (pathname === "/api/bo/workforce/planning/shift-plan") {
      return method === "POST" ? { action: "next" } : { action: "not_found" };
    }
    // PAP-1252: exact read-only BO TV Health; BFF and Core enforce Center-scoped tv.view.
    // The host fence admits neither Production nor non-GET methods.
    if (pathname === "/api/bo/tv/operator-health") {
      return hostname === BO_STAGING_HOSTNAME && method === "GET" ? { action: "next" } : { action: "not_found" };
    }
    // PAP-1111 G4: admit only staging BO note-only assignment edits.
    // Next and Core still enforce Staff identity, Center ACL, CAS and audit.
    if (hostname === BO_STAGING_HOSTNAME && pathname === "/api/bo/workforce/planning/assignment/note") {
      return method === "POST" ? { action: "next" } : { action: "not_found" };
    }
    // PAP-982 S3: exact Staging-only directory read; BFF and Core reauthorize the actor and Center.
    // All write/HEAD methods, child paths, HO/TOS and Production stay denied at the host edge.
    if (pathname.replace(/\/$/, "") === "/api/bo/pinoria/avatars") {
      return hostname === BO_STAGING_HOSTNAME && method === "GET" ? { action: "next" } : { action: "not_found" };
    }
    // PAP-1035: Worker-first admission must match the already-authenticated
    // BO read facade. This is a staging-only GET/HEAD fence, never a write bypass.
    if (hostname === BO_STAGING_HOSTNAME && (method === "GET" || method === "HEAD") && (isBoStagingS3ReadPath(pathname) || isBoStagingRunningClassEnrollmentReadPath(pathname))) return { action: "next" };
    if (pathname === "/") return { action: "redirect", pathname: "/bo" };
    if ((hostname === BO_STAGING_HOSTNAME && method === "GET" && pathname.replace(/\/$/, "") === "/api/bo/school/enrollments") || ((method === "GET" || method === "HEAD") && ["/team-legacy-global.css", "/bo-legacy-foundation.css"].includes(pathname)) || isBoLocalAuthPath(pathname) || isApprovedBoPath(pathname) || isFrameworkAsset(pathname) || (hostname === BO_STAGING_HOSTNAME && isBoStagingStylesheet(pathname))) return { action: "next" };
    return { action: "not_found" };
  }

  if (hostname === TOS_HOSTNAME || hostname === TOS_STAGING_HOSTNAME) {
    if (isPathWithin(pathname, "/bo") || isPathWithin(pathname, "/api/bo")) return { action: "not_found" };
    // Staging review uses the V4 renderer; Production TOS remains unchanged.
    if (hostname === TOS_STAGING_HOSTNAME && pathname === "/" && (method === "GET" || method === "HEAD")) {
      return { action: "redirect", pathname: "/tos-v4" };
    }
    return { action: "next" };
  }

  return { action: "next" };
}

/** PAP-1037: admit only canonical class-scoped Enrollment reads on BO Staging.
 * The BO facade independently authenticates and enforces Core Center/Path/Class ACL.
 * Never admit writes or widen Production/HO host-boundary routes.
 */
export function isBoStagingRunningClassEnrollmentReadPath(pathname: string): boolean {
  return /^\/api\/bo\/delivery\/running-classes\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/enrollments$/.test(pathname);
}

export function isBoStagingS3ReadPath(pathname: string): boolean {
  const uuid="[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
  return new RegExp(`^/api/bo/subscriptions/${uuid}(?:/(?:enrollments|placement))?$`).test(pathname)
    || new RegExp(`^/api/bo/enrollments/${uuid}$`).test(pathname)
    || pathname==="/api/bo/enrollments/capacity";
}
function isBoStagingStylesheet(pathname: string): boolean {
  return /^\/bo-skeleton\/(?:styles|playground|playground-v22|playground-v23|full-detail-v24|full-detail-v25)\.css$/.test(pathname);
}

function isBoLocalAuthPath(pathname: string): boolean {
  const normalized = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  return ["/staff-login", "/staff-password/change", "/api/staff-auth/login", "/api/staff-auth/status", "/api/staff-auth/change-password", "/api/staff-auth/logout"].includes(normalized);
}

export function requiresBoStaffPasswordSession(host: string, pathname: string): boolean {
  if (!isBoHostname(host)) return false;
  const normalized = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  return isPathWithin(normalized, "/bo");
}

function isApprovedBoPinoriaOperationalPath(normalized: string): boolean {
  const id = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
  return normalized === "/api/bo/pinoria/worlds"
    || normalized === "/api/bo/pinoria/worlds/media"
    || normalized === "/api/bo/pinoria/worlds/learners"
    || new RegExp(`^/api/bo/pinoria/worlds/(?:${id}|${id}/scenes|learners/${id}|learners/${id}/instances|scenes/${id}|scenes/${id}/layers|layers/${id}|instances/${id}|instances/${id}/(?:set-live|revoke|reactivate)|instances/${id}/scenes/${id}|instances/${id}/layers/${id}|students/${id}/live)$`).test(normalized)
    || normalized === "/api/bo/pinoria/worlds/instances"
    || normalized === "/api/bo/pinoria/onboarding/sets"
    || new RegExp(`^/api/bo/pinoria/onboarding/(?:sets/${id}|(?:students|staff)/${id}(?:/grant)?)$`).test(normalized);
}

function isApprovedBoLegacyFounderPinoriaPath(normalized: string): boolean {
  const id = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
  return normalized === "/api/founder/pinoria/wish/catalog"
    || new RegExp(`^/api/founder/pinoria/wish/catalog/(?:bearers|sets)(?:/${id})?$`).test(normalized)
    || new RegExp(`^/api/founder/pinoria/wish/catalog/wearables/${id}/projection$`).test(normalized)
    || normalized === "/api/founder/pinoria/wish/banners"
    || new RegExp(`^/api/founder/pinoria/wish/banners/${id}(?:/(?:validation|schedule|activate|retire))?$`).test(normalized)
    || normalized === "/api/founder/pinoria/wish/rules"
    || normalized === "/api/founder/pinoria/wish/release-phases"
    || new RegExp(`^/api/founder/pinoria/wish/release-phases/${id}(?:/(?:validation|publish|retire|assign))?$`).test(normalized)
    || normalized === "/api/founder/pinoria/wish/resources/energy-seeds/learners"
    || new RegExp(`^/api/founder/pinoria/wish/resources/energy-seeds/learners/${id}(?:/corrections)?$`).test(normalized)
    || normalized === "/api/founder/pinoria/companions/species"
    || new RegExp(`^/api/founder/pinoria/companions/species/${id}(?:/(?:activate|archive))?$`).test(normalized)
    || normalized === "/api/founder/pinoria/companions/eggs";
}

function isApprovedBoPath(pathname: string): boolean {
  const normalized = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  if (isApprovedBoPinoriaOperationalPath(normalized) || isApprovedBoLegacyFounderPinoriaPath(normalized)) return true;
  // PAP-1033: admit Subscription Shared Views through the BO host fence. The authenticated BFF
  // and Core enforce GLOBAL membership.subscription.view for reads and separate GLOBAL manage for writes.
  if (/^\/api\/bo\/views\/(?:students|classes|subscriptions)(?:\/(?:[0-9a-f-]{36}(?:\/rename)?|reorder))?$/.test(normalized)) return true;
  if (/^\/api\/bo\/identity\/parents\/[0-9a-f-]{36}\/detail$/.test(normalized)) return true;
  if ([
    "/bo",
    "/bo/profile",
    "/bo/staff",
    "/bo/workforce",
    "/bo/workforce-shift-plans",
    "/bo/workforce-availability",
    "/bo/workforce-assignments",
    "/bo/payroll-periods",
    "/bo/workforce/check-in-exceptions",
    "/bo/workforce/timekeeping",
    "/bo/workforce/duty-exceptions",
    "/bo/workforce/compensation",
    "/bo/workforce/payroll",
    "/bo/workforce/payroll/extra-time",
    "/bo/training",
    "/bo/training/builder",
    "/bo/learners",
    "/bo/student-visits",
    "/bo/subscriptions",
    "/bo/sales/leads",
    "/bo/open-studio",
    "/api/bo/open-studio/walkin/inventory",
    "/api/bo/open-studio/walkin/batches",
    "/api/bo/open-studio/walkin/assign",
    "/api/bo/open-studio/walkin/revoke",
    "/bo/tvs",
    "/bo/delivery-activation",
    "/bo/calendar",
    "/bo/running-classes",
    "/bo/sessions",
    "/bo/registrations",
    "/bo/syllabus",
    "/bo/practice",
    "/bo/missions",
    "/bo/pinoria-effects",
    "/bo/pinoria-tv-policy",
    "/bo/pinoria-tv-operator",
    "/bo/pinoria-wish",
    "/bo/pinoria-activities",
    "/bo/pinoria-companions",
    "/bo/pinoria-ward/learners",
    "/bo/content",
    "/bo/system/policies",
    "/bo/system/policies",
    "/bo/system/audit",
    "/bo/system/ai-data",
    "/bo/system/pancake",
    "/staff-login",
    "/api/staff-auth/login",
    "/api/staff-auth/logout",
    "/api/staff-auth/status",
    "/api/bo/context",
    "/api/bo/legacy-imports/pap21/dry-run",
    "/api/bo/legacy-imports/pap21/execute",
    "/api/bo/tv/displays",
    "/api/bo/tv/devices",
    "/api/bo/pinoria/effects/catalog",
    "/api/bo/learners",
    "/api/bo/audit/subject",
    "/api/bo/identity/parents",
    "/api/bo/identity/parents/directory",
    "/api/bo/student-intakes",
    "/api/bo/practice/authoring-context",
    "/api/bo/practice/repertoire-access/context",
    "/api/bo/practice/repertoire-access",
    "/api/bo/practice/repertoire-access/grants",
    "/api/bo/practice/resources",
    "/api/bo/practice/media",
    "/api/bo/open-studio/operations",
    "/api/bo/open-studio/listing-catalog",
    "/api/bo/open-studio/learners",
    "/api/bo/open-studio/passes",
    "/api/bo/open-studio/listings",
    "/api/bo/open-studio/member-path-centers/assign",
    "/api/bo/open-studio/member-path-centers/reassign",
    "/api/bo/open-studio/member-centers/assign",
    "/api/bo/open-studio/member-centers/reassign",
    "/api/bo/open-studio/passes/issue-monthly-path",
    "/api/bo/open-studio/passes/issue-bring-a-friend",
    "/api/bo/open-studio/admission",
    "/api/bo/centers",
    "/api/bo/delivery/bootstrap-state",
    "/api/bo/delivery/calendar-scope",
    "/api/bo/delivery/calendar-exclusions",
    "/api/bo/delivery/calendar-exclusions/preview",
    "/api/bo/delivery/enrollment-activation",
    "/api/bo/delivery/terms",
    "/api/bo/delivery/term-weeks",
    "/api/bo/delivery/learning-spaces",
    "/api/bo/delivery/running-classes",
    "/api/bo/delivery/running-class-blocks",
    "/api/bo/delivery/materializations",
    "/api/bo/policies/delivery/materialization.v1/versions",
    "/api/bo/path-programs",
    "/api/bo/running-classes",
    "/api/bo/syllabi",
    "/api/bo/sessions",
    "/api/bo/access/roles",
    "/api/bo/access/permissions",
    "/api/bo/access/audit",
    "/api/bo/access/users",
    "/api/bo/workforce/staff-records",
    "/api/bo/workforce/staff-onboarding",
    "/api/bo/workforce/staff-registration-settings",
    "/api/bo/workforce/staff-registration-requests",
    "/api/bo/workforce/timekeeping",
    "/api/bo/workforce/timekeeping/centers",
    "/api/bo/workforce/duty/checkout-exceptions",
    "/api/bo/workforce/planning/bootstrap",
    "/api/bo/workforce/planning/global-weeks",
    "/api/bo/workforce/planning/shift-templates",
    "/api/bo/workforce/planning/weekly",
    "/api/bo/workforce/planning/week-control",
    "/api/bo/workforce/planning/availability/registration",
    "/api/bo/workforce/planning/availability/lock",
    "/api/bo/workforce/planning/availability/reopen",
    "/api/bo/workforce/planning/planning/publish",
    "/api/bo/workforce/planning/planning/reopen",
    "/api/bo/workforce/planning/operational-assignment",
    "/api/bo/workforce/planning/assignment",
    "/api/bo/workforce/planning/assignment/cancel",
    "/api/bo/access/assignments",
    "/api/bo/access/assignments/remove",
    "/api/bo/access/users/status",
    "/api/bo/access/support-sessions",
    "/api/bo/access/perimeter-reconcile",
    "/favicon.ico",
  ].includes(normalized)) return true;
  // PAP-863: source-backed, exact BO contracts only. All operations still require Staff
  // password authentication and the canonical Core permission checks.
  if (/^\/api\/bo\/learning\/missions(?:\/[0-9a-f-]{36})?$/.test(normalized)
    || /^\/api\/bo\/student-visits(?:\/check-in|\/[0-9a-f-]{36}(?:\/(?:check-out|correct))?)?$/.test(normalized)
    || /^\/api\/bo\/workforce\/payroll\/periods(?:\/[0-9a-f-]{36}(?:\/(?:staff-rollup|settlements)|\/staff\/[0-9a-f-]{36}\/(?:preview|finalize))?)?$/.test(normalized)
    || /^\/api\/bo\/workforce\/payroll\/settlements\/[0-9a-f-]{36}\/paid$/.test(normalized)
    || /^\/api\/bo\/workforce\/payroll\/extra-time\/reviews(?:\/[0-9a-f-]{36}(?:\/decision)?)?$/.test(normalized)
    || /^\/api\/bo\/workforce\/staff-records\/[0-9a-f-]{36}\/private\/compensation(?:\/[0-9a-f-]{36})?$/.test(normalized)
    || /^\/api\/bo\/pinoria\/tv-config\/policy\/(?:head|versions|version|active|drafts|publish|revert)$/.test(normalized)) return true;
  if (normalized === "/api/founder/web-cms/manifests/sync") return true;
  if (/^\/api\/founder\/ai\/change-sets(?:\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:\/(?:approve|reject|reconcile))?)?$/.test(normalized)) return true;
  return /^\/api\/bo\/learning\/syllabi(?:\/owners|\/media(?:\/[0-9a-f-]{36}\/preview)?|\/[0-9a-f-]{36}(?:\/(?:draft|publish|next-draft|archive))?|\/versions\/[0-9a-f-]{36}\/(?:artchitect-profile|pianohouse-profile|little-piner-profile))?$/.test(normalized)
    || /^\/api\/bo\/acquisition\/intents(?:\/[0-9a-f-]{36}(?:\/(?:contacted|verify-contact|close))?)?$/.test(normalized)
    || /^\/api\/bo\/acquisition\/leads\/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/archive$/.test(normalized)
    || /^\/api\/bo\/acquisition\/pancake\/(?:settings|channels(?:\/[0-9a-f-]{36}\/configure)?)$/.test(normalized)
    || /^\/api\/bo\/web-cms\/slots(?:\/[0-9a-f-]{36}(?:\/(?:history|draft|publish|rollback))?)?$/.test(normalized)
    || /^\/api\/bo\/pinoria\/ward\/catalog(?:\/(?:items|variants)(?:\/[0-9a-f-]{36})?)?$/.test(normalized)
    || /^\/api\/bo\/pinoria\/ward\/sets(?:\/[0-9a-f-]{36}(?:\/members)?)?$/.test(normalized)
    || normalized === "/api/bo/pinoria/ward/set-webm-assets"
    || /^\/api\/bo\/pinoria\/ward\/learners(?:\/[0-9a-f-]{36}(?:\/(?:grants|revocations|loadout|accessories))?)?$/.test(normalized)
    || /^\/api\/bo\/practice\/repertoire-access\/grants\/[0-9a-f-]{36}\/revoke$/.test(normalized)
    || /^\/api\/bo\/practice\/resources\/[0-9a-f-]{36}(?:\/drafts)?$/.test(normalized)
    || /^\/api\/bo\/practice\/versions\/[0-9a-f-]{36}(?:\/(?:pages|publish))?$/.test(normalized)
    || /^\/api\/bo\/tv\/devices\/[0-9a-f-]{36}\/update$/.test(normalized)
    || /^\/api\/bo\/access\/roles\/[0-9a-f-]{36}(?:\/(?:duplicate|update|archive))?$/.test(normalized)
    || /^\/api\/bo\/access\/users\/[0-9a-f-]{36}\/staff-password\/reset$/.test(normalized)
    || /^\/api\/bo\/workforce\/staff-records\/[0-9a-f-]{36}(?:\/(?:status|pinoria|private(?:\/documents\/[0-9a-f-]{36})?))?$/.test(normalized)
    || /^\/api\/bo\/workforce\/staff-registration-requests\/[0-9a-f-]{36}\/(?:approve|reject)$/.test(normalized)
    || /^\/api\/bo\/workforce\/timekeeping\/[0-9a-f-]{36}\/(?:corrections|resolve-missed-checkout)$/.test(normalized)
    || /^\/api\/bo\/workforce\/duty\/checkout-exceptions\/[0-9a-f-]{36}\/approve$/.test(normalized)
    || /^\/api\/bo\/workforce\/training\/(?:catalog|modules|assignments|staff\/[0-9a-f-]{36}|versions\/[0-9a-f-]{36}\/(?:draft|publish)|modules\/[0-9a-f-]{36}\/(?:next-draft|retire)|assignments\/[0-9a-f-]{36}\/signoff|qualifications\/[0-9a-f-]{36}\/revoke)$/.test(normalized)
    || /^\/api\/bo\/workforce\/planning\/check-in-exceptions(?:\/centers|\/[0-9a-f-]{36}(?:\/(?:approve|decline))?)?$/.test(normalized)
    || /^\/api\/bo\/workforce\/planning\/shift-templates\/[0-9a-f-]{36}\/status$/.test(normalized)
    || /^\/api\/bo\/workforce\/planning\/availability\/[0-9a-f-]{36}\/void$/.test(normalized)
    || /^\/api\/bo\/sessions\/[0-9a-f-]+\/registrations$/.test(normalized)
    || /^\/api\/bo\/delivery\/term-weeks\/[0-9a-f-]{36}\/(?:update|delete)$/.test(normalized)
    || /^\/api\/bo\/delivery\/terms\/[0-9a-f-]{36}\/neutralize$/.test(normalized)
    || /^\/api\/bo\/delivery\/(?:learning-spaces|running-classes)\/[0-9a-f-]{36}\/lifecycle$/.test(normalized)
    || /^\/api\/bo\/delivery\/sessions\/[0-9a-f-]{36}\/syllabus-binding$/.test(normalized)
    || /^\/api\/bo\/delivery\/calendar-exclusions\/[0-9a-f-]{36}$/.test(normalized)
    || /^\/api\/bo\/policies\/delivery\/materialization\.v1\/versions\/[0-9a-f-]{36}\/publish$/.test(normalized)
    || /^\/api\/bo\/policies\/delivery\/future_reservation\.v1\/(?:effective|stream|versions)$/.test(normalized)
    || /^\/api\/bo\/policies\/delivery\/future_reservation\.v1\/versions\/[0-9a-f-]{36}\/publish$/.test(normalized)
    || /^\/api\/bo\/policies\/workforce\/(?:AVAILABILITY_WINDOW_V1|PLANNING_WINDOW_V1)\/(?:effective|stream|versions)$/.test(normalized)
    || /^\/api\/bo\/policies\/workforce\/(?:AVAILABILITY_WINDOW_V1|PLANNING_WINDOW_V1)\/versions\/[0-9a-f-]{36}\/publish$/.test(normalized)
    || /^\/api\/bo\/policies\/open_studio\/(?:monthly_path_pass\.v1|bring_a_friend\.v1|public_acquisition\.v1|cancellation\.v1)\/(?:effective|stream|versions)$/.test(normalized)
    || /^\/api\/bo\/policies\/open_studio\/(?:monthly_path_pass\.v1|bring_a_friend\.v1|public_acquisition\.v1|cancellation\.v1)\/versions\/[0-9a-f-]{36}\/publish$/.test(normalized)
    || /^\/api\/bo\/policies\/workforce\/(?:AVAILABILITY_ELIGIBILITY|TIMEKEEPING_ELIGIBILITY)\/(?:effective|stream|versions)$/.test(normalized)
    || /^\/api\/bo\/policies\/workforce\/(?:AVAILABILITY_ELIGIBILITY|TIMEKEEPING_ELIGIBILITY)\/versions\/[0-9a-f-]{36}\/publish$/.test(normalized)
    || /^\/api\/bo\/student-intakes\/[0-9a-f-]{36}\/void$/.test(normalized)
    || /^\/api\/bo\/open-studio\/students\/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/lifecycle$/.test(normalized)
    || /^\/api\/bo\/students\/[0-9a-f-]{36}\/lifecycle$/.test(normalized)
    || /^\/api\/bo\/students\/[0-9a-f-]{36}\/pinoria(?:\/companions\/[0-9a-f-]{36}\/feed)?$/.test(normalized)
    || /^\/api\/bo\/identity\/parents\/[0-9a-f-]{36}\/pin\/reset$/.test(normalized)
    || /^\/api\/bo\/billing\/product-plans(?:\/[0-9a-f-]{36}\/configure)?$/.test(normalized)
    || normalized === "/api/bo/billing/sales"
    || /^\/api\/bo\/billing\/bills\/[0-9a-f-]{36}(?:\/(?:transactions|void))?$/.test(normalized)
    || /^\/api\/bo\/billing\/transactions\/[0-9a-f-]{36}\/void$/.test(normalized)
    || (normalized === "/api/bo/catalog/paths" || /^\/api\/bo\/catalog\/paths\/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized))
    || /^\/api\/bo\/catalog\/specialty-(?:families|modules)$/.test(normalized)
    || normalized === "/api/bo/specialty/catalog"
    || /^\/api\/bo\/specialty\/students\/[0-9a-f-]{36}$/.test(normalized)
    || /^\/api\/bo\/specialty\/(?:offers(?:\/[0-9a-f-]{36}\/configure)?|relics|rewards|purchases(?:\/evaluate)?|allocations\/[0-9a-f-]{36}\/(?:claims|complete)|physical-rewards\/[0-9a-f-]{36}\/fulfill)$/.test(normalized)
    || /^\/api\/bo\/policies\/specialty\/(?:purchase\.v1|session_settlement\.v1|completion\.v1|reward\.v1)\/(?:effective|stream|versions)$/.test(normalized)
    || /^\/api\/bo\/policies\/specialty\/(?:purchase\.v1|session_settlement\.v1|completion\.v1|reward\.v1)\/versions\/[0-9a-f-]{36}\/publish$/.test(normalized)
    || /^\/api\/bo\/subscriptions(?:\/[0-9a-f-]{36}\/(?:activate|renew|supersede|cancel|neutralize|service-grants|pauses|renewal-grace|projected-completion))?$/.test(normalized)
    || /^\/api\/bo\/billing\/(?:product-plans(?:\/[0-9a-f-]{36}\/configure)?|sales|bills\/[0-9a-f-]{36}(?:\/(?:transactions|void))?|transactions\/[0-9a-f-]{36}\/void)$/.test(normalized)
    || /^\/api\/bo\/subscription-pauses\/[0-9a-f-]{36}\/cancel$/.test(normalized)
    || /^\/api\/bo\/renewal-grace\/[0-9a-f-]{36}\/revoke$/.test(normalized)
    || /^\/api\/bo\/enrollments(?:\/(?:bulk-preflight|bulk-place|[0-9a-f-]{36}\/(?:transfer|end)))?$/.test(normalized)
    || /^\/api\/bo\/open-studio\/listings\/[0-9a-f-]{36}\/(?:publish|close|cancel)$/.test(normalized)
    || /^\/api\/bo\/open-studio\/passes\/[0-9a-f-]{36}\/(?:revoke|claim-eligibility)$/.test(normalized);
}

export function requiresTosStaffSession(host: string, pathname: string): boolean {
  if (tosV4StagingHost(normalizeHostname(host)) && isPathWithin(pathname, "/tos-v4")) return true;
  if (![TOS_HOSTNAME, TOS_STAGING_HOSTNAME].includes(normalizeHostname(host))) return false;
  const normalized = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  if (normalized === "/") return true;
  return ["/dashboard", "/schedule", "/availability", "/classroom", "/tasks", "/training", "/open-studio", "/pinoria", "/pinoria-tv", "/tv", "/timesheet", "/earnings", "/check-in", "/info"]
    .some((prefix) => normalized === prefix || normalized.startsWith(prefix + "/"));
}


function isStaffRegistrationPath(pathname: string): boolean {
  const normalized = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  return normalized === "/staff/register" || normalized === "/api/staff-registration";
}

function isLocalOrPreviewHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname.endsWith(".workers.dev");
}

function isFrameworkAsset(pathname: string): boolean {
  return pathname.startsWith("/_next/");
}

function isPathWithin(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function normalizeHostname(host: string): string {
  return host.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
}
