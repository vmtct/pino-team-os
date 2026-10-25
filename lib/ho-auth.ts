import { authorizeBoShell, BoShellGateError, type BoShellGateEnv } from "./bo-shell-gate";
import { HO_STAGING_HOSTNAME, normalizeHostname } from "./host-boundary";
export interface HoEnv extends BoShellGateEnv { APP_ENV?: string; HO_PILOT_FOUNDER_USER_IDS?: string }
/** Pilot cohort restricts an already authenticated Core principal; it never grants permissions. */
export async function authorizeHoShell(headers: Headers, env: HoEnv) {
  if (env.APP_ENV !== "staging" || normalizeHostname(headers.get("host") || "") !== HO_STAGING_HOSTNAME) throw new BoShellGateError(404, "Not found");
  const context = await authorizeBoShell(headers, env);
  const admitted = (env.HO_PILOT_FOUNDER_USER_IDS || "").split(",").map(id => id.trim()).filter(Boolean);
  if (!admitted.includes(context.userId)) throw new BoShellGateError(403, "Head Office access denied");
  // Core still evaluates live team.bo.access and bo.operations.view @ GLOBAL on Center reads.
  return context;
}
