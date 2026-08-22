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
    "/bo/running-classes",
    "/bo/sessions",
    "/bo/registrations",
    "/bo/syllabus",
    "/api/bo/context",
    "/api/bo/path-programs",
    "/api/bo/running-classes",
    "/api/bo/syllabi",
    "/api/bo/sessions",
    "/favicon.ico",
  ].includes(normalized)) return true;
  return /^\/api\/bo\/sessions\/[0-9a-f-]+\/registrations$/.test(normalized);
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
