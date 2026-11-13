/** PAP-1646 / Epic PAP-650 PNR-TV — F1 URL contract only, not a live route.
 * Stable Policy references are NOT bearer credentials or authorization.
 * Real playback remains denied until Core verifies session, selected Center
 * and the active published Policy; PAP-9/PAP-1921 keeps ACL F3 locked.
 * This does not mount an endpoint or alter the legacy physical /tv/[displayId].
 */
const ROOT = "/tv/p/";
const DEFAULT = "tvp1-default";
const CENTER_REF = /^tvp1-center-[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Exact Core PAP-1650 reference grammar; never a version or physical Display ID. */
export function isStableTvPolicyRef(ref: unknown): ref is string {
  return typeof ref === "string" && (ref === DEFAULT || CENTER_REF.test(ref));
}

/** Prepared same-origin link path for HO Open TV / Copy URL actions (not mounted). */
export function formatTvPolicyViewerPath(ref: unknown): string | null {
  return isStableTvPolicyRef(ref) ? ROOT + ref : null;
}

/** Strict parser for future read-only Viewer route: never decode/query-match loosely. */
export function parseTvPolicyViewerPath(path: unknown): string | null {
  if (typeof path !== "string" || !path.startsWith(ROOT)) return null;
  const ref = path.slice(ROOT.length);
  return isStableTvPolicyRef(ref) && path === ROOT + ref ? ref : null;
}
