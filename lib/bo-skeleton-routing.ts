export const BO_SKELETON_HOST = "pino-team-os-staging.minhtri-van42.workers.dev";

/** Presence check only. The server layout/BFF still validate the actual Core session and ACL. */
export function requiresBoStagingPageSession(host: string, pathname: string): boolean {
  return host.toLowerCase().replace(/:443$/, "") === BO_SKELETON_HOST &&
    (pathname === "/bo" || pathname.startsWith("/bo/"));
}

// The controller still checks its staging flag and authorizes every request.
// Turning the flag off fails closed; restoring an older UI uses version rollback.
export function boSkeletonRoute(host: string, pathname: string): "runtime" | "redirect" | null {
  if (host.toLowerCase().replace(/:443$/, "") !== BO_SKELETON_HOST) return null;
  if (pathname === "/bo" || pathname === "/bo/") return "runtime";
  return pathname === "/bo-skeleton/playground.html" ? "redirect" : null;
}
