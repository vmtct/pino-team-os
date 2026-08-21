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
    if (isBoFoundationPath(pathname) || isFrameworkAsset(pathname)) return { action: "next" };
    return { action: "not_found" };
  }

  if (hostname === TOS_HOSTNAME) {
    if (isPathWithin(pathname, "/bo") || isPathWithin(pathname, "/api/bo")) return { action: "not_found" };
    return { action: "next" };
  }

  return { action: "next" };
}

function isBoFoundationPath(pathname: string): boolean {
  return pathname === "/bo"
    || pathname === "/bo/"
    || pathname === "/api/bo/context"
    || pathname === "/api/bo/context/"
    || pathname === "/favicon.ico";
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
