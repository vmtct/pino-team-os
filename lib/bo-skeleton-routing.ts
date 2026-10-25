export const BO_SKELETON_HOST = "pino-team-os-staging.minhtri-van42.workers.dev";

// The controller still checks its staging flag and authorizes every request.
// Turning the flag off fails closed; restoring an older UI uses version rollback.
export function boSkeletonRoute(host: string, pathname: string): "rewrite" | "redirect" | null {
  if (host.toLowerCase().replace(/:443$/, "") !== BO_SKELETON_HOST) return null;
  if (pathname === "/bo" || pathname === "/bo/") return "rewrite";
  return pathname === "/bo-skeleton/playground.html" ? "redirect" : null;
}
