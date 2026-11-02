/** PAP-1316 / PAP-1327: one declarative BO Center scope registry.
 * The shell owns selection; domain Core APIs own authorization and all SQL filtering.
 * UNVERIFIED and MIXED must never be silently treated as CENTER.
 */
import { boCenterWave1Href, isBoCenterReadWave1 } from "./BoCenterWave1";
import { scopedClassesFetcher } from "./BoScopedClassRead";
import { scopedLearnerFetcher } from "./BoScopedLearnerRead";

export type BoCenterModuleScope = "CENTER" | "MIXED" | "GLOBAL" | "UNVERIFIED";
// These screens mix authorized Center operations with legacy/unverified global reads.
// They are NOT auto-admitted by choosing a Center at the shell.
const MIXED_MODULES = new Set(["subscriptions", "enrollments", "parents"]);
const CENTER_WORKFORCE_ROUTES: Record<string, string> = {
  "workforce-shift-plans": "/bo/workforce-shift-plans",
  "workforce-availability": "/bo/workforce-availability",
  "workforce-assignments": "/bo/workforce-assignments",
};
const VERIFIED_GLOBAL_MODULES = new Set<string>(); // Admit only after a Core contract audit.

export function boCenterModuleScope(moduleKey: string): BoCenterModuleScope {
  if (isBoCenterReadWave1(moduleKey) || Object.hasOwn(CENTER_WORKFORCE_ROUTES, moduleKey)) return "CENTER";
  if (MIXED_MODULES.has(moduleKey)) return "MIXED";
  if (VERIFIED_GLOBAL_MODULES.has(moduleKey)) return "GLOBAL";
  return "UNVERIFIED";
}

export function scopedBoReadFetcher(moduleKey: string, fetcher: typeof fetch, authorizedCenterId: string): typeof fetch {
  if (Object.hasOwn(CENTER_WORKFORCE_ROUTES, moduleKey)) return fetcher; // BO source supplies authorized Center to the server-bound Workforce adapter
  if (!isBoCenterReadWave1(moduleKey)) throw Error("Module chưa có hợp đồng đọc theo cơ sở.");
  switch (moduleKey) {
    case "students": return scopedLearnerFetcher(fetcher, authorizedCenterId);
    case "classes": return scopedClassesFetcher(fetcher, authorizedCenterId);
    case "visits":
    case "timekeeping": return fetcher; // school adapter validates Center scope per row
    default: throw Error("Module chưa có hợp đồng đọc theo cơ sở.");
  }
}

export function boScopedModuleHref(href: string, moduleKey: string, selected: string, authorizedIds: readonly string[]): string {
  const expectedRoute = CENTER_WORKFORCE_ROUTES[moduleKey];
  if (!expectedRoute) return boCenterWave1Href(href, moduleKey, selected, authorizedIds);
  if (!authorizedIds.includes(selected)) return href;
  const url = new URL(href, "https://bo.invalid");
  if (url.origin !== "https://bo.invalid" || url.pathname !== expectedRoute) return href;
  url.searchParams.delete("record");
  url.searchParams.set("centerId", selected);
  url.hash = "";
  return url.pathname + url.search;
}

/** URL is higher priority than a previous session hint, including a forged URL.
 * A session value never grants access: it is accepted only if in Core-authorized centers.
 */
export function restoreBoAuthorizedCenter(
  authorizedIds: readonly string[],
  search: string,
  sessionHint: string | null,
): { selected: string; invalidExplicit: boolean } {
  const params = new URLSearchParams(search);
  const requested = params.getAll("centerId");
  if (requested.length) {
    const selected = requested.length === 1 && authorizedIds.includes(requested[0]!) ? requested[0]! : "";
    return { selected, invalidExplicit: !selected };
  }
  return { selected: sessionHint && authorizedIds.includes(sessionHint) ? sessionHint : "", invalidExplicit: false };
}

export const BO_ACTIVE_CENTER_SESSION_KEY = "pino:bo:active-center:v1";
