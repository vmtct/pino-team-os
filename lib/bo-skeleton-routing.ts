export const BO_SKELETON_HOST = "pino-team-os-staging.minhtri-van42.workers.dev";
export const BO_STAGING_CUSTOM_HOST = "bo.staging.pinohouse.art";
export function isBoStagingHost(host: string): boolean {
  const normalized = host.trim().toLowerCase().replace(/\.$/, "").replace(/:\d+$/, "");
  return normalized === BO_SKELETON_HOST || normalized === BO_STAGING_CUSTOM_HOST;
}

/** Presence check only. The server layout/BFF still validate the actual Core session and ACL. */
export function requiresBoStagingPageSession(host: string, pathname: string): boolean {
  return isBoStagingHost(host) &&
    (pathname === "/bo" || pathname.startsWith("/bo/"));
}

// The controller still checks its staging flag and authorizes every request.
// Turning the flag off fails closed; restoring an older UI uses version rollback.
export function boSkeletonRoute(host: string, pathname: string): "runtime" | "redirect" | null {
  if (!isBoStagingHost(host)) return null;
  if (pathname === "/bo" || pathname === "/bo/") return "runtime";
  return pathname === "/bo-skeleton/playground.html" ? "redirect" : null;
}
