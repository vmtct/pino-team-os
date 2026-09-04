export const TOS_HOSTNAME = "tos.pinohouse.art";
export const BO_HOSTNAME = "bo.pinohouse.art";
export const STAFF_REGISTRATION_HOSTNAME = "join.pinohouse.art";
export const RETIRED_TEAM_HOSTNAME = "team.pinohouse.art";

export type HostBoundaryDecision =
  | { action: "next" }
  | { action: "redirect"; pathname: "/bo" }
  | { action: "not_found" };

export function decideHostBoundary(host: string, pathname: string): HostBoundaryDecision {
  const hostname = normalizeHostname(host);

  if (hostname === RETIRED_TEAM_HOSTNAME) return { action: "not_found" };

  if (hostname === STAFF_REGISTRATION_HOSTNAME) {
    const normalized = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
    if (normalized === "/staff/register" || normalized === "/api/staff-registration" || normalized === "/favicon.ico" || isFrameworkAsset(normalized)) return { action: "next" };
    return { action: "not_found" };
  }

  if (hostname === BO_HOSTNAME) {
    if (pathname === "/") return { action: "redirect", pathname: "/bo" };
    if (isApprovedBoPath(pathname) || isFrameworkAsset(pathname)) return { action: "next" };
    return { action: "not_found" };
  }

  if (hostname === TOS_HOSTNAME) {
    if (isPathWithin(pathname, "/bo") || isPathWithin(pathname, "/api/bo")) return { action: "not_found" };
    return { action: "next" };
  }

  return { action: "next" };
}

function isApprovedBoPath(pathname: string): boolean {
  const normalized = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  if ([
    "/bo",
    "/bo/staff",
    "/bo/workforce",
    "/bo/training",
    "/bo/learners",
    "/bo/open-studio",
    "/bo/delivery-activation",
    "/bo/running-classes",
    "/bo/sessions",
    "/bo/registrations",
    "/bo/syllabus",
    "/bo/practice",
    "/bo/system/users",
    "/bo/system/roles",
    "/bo/system/audit",
    "/staff-pin/change",
    "/api/bo/context",
    "/api/bo/learners",
    "/api/bo/practice/authoring-context",
    "/api/bo/practice/repertoire-access/context",
    "/api/bo/practice/repertoire-access",
    "/api/bo/practice/repertoire-access/grants",
    "/api/bo/practice/resources",
    "/api/bo/practice/media",
    "/api/bo/open-studio/operations",
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
    "/api/bo/delivery/enrollment-activation",
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
    "/api/bo/workforce/planning/weekly",
    "/api/bo/workforce/planning/assignment",
    "/api/bo/workforce/planning/assignment/cancel",
    "/api/bo/access/assignments",
    "/api/bo/access/assignments/remove",
    "/api/bo/access/users/status",
    "/api/bo/access/perimeter-reconcile",
    "/api/staff-pin/status",
    "/api/staff-pin/change",
    "/favicon.ico",
  ].includes(normalized)) return true;
  return /^\/api\/bo\/practice\/repertoire-access\/grants\/[0-9a-f-]{36}\/revoke$/.test(normalized)
    || /^\/api\/bo\/practice\/resources\/[0-9a-f-]{36}(?:\/drafts)?$/.test(normalized)
    || /^\/api\/bo\/practice\/versions\/[0-9a-f-]{36}(?:\/(?:pages|publish))?$/.test(normalized)
    || /^\/api\/bo\/access\/roles\/[0-9a-f-]{36}(?:\/(?:duplicate|update|archive))?$/.test(normalized)
    || /^\/api\/bo\/access\/users\/[0-9a-f-]{36}\/staff-pin\/reset$/.test(normalized)
    || /^\/api\/bo\/workforce\/staff-records\/[0-9a-f-]{36}(?:\/status)?$/.test(normalized)
    || /^\/api\/bo\/workforce\/staff-registration-requests\/[0-9a-f-]{36}\/(?:approve|reject)$/.test(normalized)
    || /^\/api\/bo\/workforce\/training\/(?:catalog|modules|assignments|staff\/[0-9a-f-]{36}|versions\/[0-9a-f-]{36}\/(?:draft|publish)|modules\/[0-9a-f-]{36}\/(?:next-draft|retire)|assignments\/[0-9a-f-]{36}\/signoff|qualifications\/[0-9a-f-]{36}\/revoke)$/.test(normalized)
    || /^\/api\/bo\/sessions\/[0-9a-f-]+\/registrations$/.test(normalized)
    || /^\/api\/bo\/policies\/delivery\/materialization\.v1\/versions\/[0-9a-f-]{36}\/publish$/.test(normalized)
    || /^\/api\/bo\/policies\/open_studio\/(?:monthly_path_pass\.v1|bring_a_friend\.v1|public_acquisition\.v1|cancellation\.v1)\/(?:effective|stream|versions)$/.test(normalized)
    || /^\/api\/bo\/policies\/open_studio\/(?:monthly_path_pass\.v1|bring_a_friend\.v1|public_acquisition\.v1|cancellation\.v1)\/versions\/[0-9a-f-]{36}\/publish$/.test(normalized)
    || /^\/api\/bo\/students\/[0-9a-f-]{36}\/lifecycle$/.test(normalized)
    || /^\/api\/bo\/students\/[0-9a-f-]{36}\/pinoria(?:\/companions\/[0-9a-f-]{36}\/feed)?$/.test(normalized)
    || /^\/api\/bo\/identity\/parents\/[0-9a-f-]{36}\/pin\/reset$/.test(normalized)
    || /^\/api\/bo\/subscriptions(?:\/[0-9a-f-]{36}\/(?:activate|renew|supersede|cancel|service-grants|pauses|renewal-grace))?$/.test(normalized)
    || /^\/api\/bo\/subscription-pauses\/[0-9a-f-]{36}\/cancel$/.test(normalized)
    || /^\/api\/bo\/renewal-grace\/[0-9a-f-]{36}\/revoke$/.test(normalized)
    || /^\/api\/bo\/enrollments(?:\/(?:bulk-preflight|bulk-place|[0-9a-f-]{36}\/(?:transfer|end)))?$/.test(normalized)
    || /^\/api\/bo\/open-studio\/listings\/[0-9a-f-]{36}\/(?:publish|close|cancel)$/.test(normalized)
    || /^\/api\/bo\/open-studio\/passes\/[0-9a-f-]{36}\/(?:revoke|claim-eligibility)$/.test(normalized);
}

export function requiresTosStaffSession(host: string, pathname: string): boolean {
  if (normalizeHostname(host) !== TOS_HOSTNAME) return false;
  const normalized = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  if (normalized === "/") return true;
  return ["/dashboard", "/schedule", "/availability", "/classroom", "/tasks", "/training", "/open-studio", "/pinoria", "/pinoria-tv", "/timesheet", "/check-in", "/info"]
    .some((prefix) => normalized === prefix || normalized.startsWith(prefix + "/"));
}

function isFrameworkAsset(pathname: string): boolean {
  return pathname.startsWith("/_next/");
}

function isPathWithin(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function normalizeHostname(host: string): string {
  return host.trim().toLowerCase().replace(/\.$/, "").replace(/:\d+$/, "");
}
