export const TOS_HOSTNAME = "tos.pinohouse.art";
export const BO_HOSTNAME = "bo.pinohouse.art";
export const RETIRED_TEAM_HOSTNAME = "team.pinohouse.art";

export type HostBoundaryDecision =
  | { action: "next" }
  | { action: "redirect"; pathname: "/bo" }
  | { action: "not_found" };

export function decideHostBoundary(host: string, pathname: string): HostBoundaryDecision {
  const hostname = normalizeHostname(host);

  if (hostname === RETIRED_TEAM_HOSTNAME) return { action: "not_found" };

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
    "/bo/delivery-activation",
    "/bo/running-classes",
    "/bo/sessions",
    "/bo/registrations",
    "/bo/syllabus",
    "/api/bo/context",
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
    "/api/bo/access/users",
    "/api/bo/workforce/staff-records",
    "/api/bo/workforce/staff-onboarding",
    "/api/bo/access/assignments",
    "/api/bo/access/assignments/remove",
    "/api/bo/access/users/status",
    "/api/bo/access/perimeter-reconcile",
    "/api/staff-pin/configure",
    "/favicon.ico",
  ].includes(normalized)) return true;
  return /^\/api\/bo\/workforce\/staff-records\/[0-9a-f-]{36}(?:\/status)?$/.test(normalized)
    || /^\/api\/bo\/sessions\/[0-9a-f-]+\/registrations$/.test(normalized)
    || /^\/api\/bo\/policies\/delivery\/materialization\.v1\/versions\/[0-9a-f-]{36}\/publish$/.test(normalized);
}

export function requiresTosStaffSession(host: string, pathname: string): boolean {
  if (normalizeHostname(host) !== TOS_HOSTNAME) return false;
  const normalized = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  if (normalized === "/") return true;
  return ["/dashboard", "/schedule", "/classroom", "/pinoria", "/pinoria-tv", "/timesheet", "/check-in", "/info"]
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
