import { authorizeBoShell, BoShellGateError, type BoShellGateEnv } from "./bo-shell-gate";
import { callBoAccessCoreWithCredential } from "./bo-core";
import { teamCredentialFromHeaders, TeamAuthError } from "./team-auth";
import { HO_STAGING_HOSTNAME, normalizeHostname } from "./host-boundary";
export interface HoEnv extends BoShellGateEnv { APP_ENV?: string; HO_PILOT_FOUNDER_USER_IDS?: string }
/** Founder-only HO needs current Core role proof as well as staging cohort admission. */
export async function authorizeHoShell(headers: Headers, env: HoEnv) {
  if (env.APP_ENV !== "staging" || normalizeHostname(headers.get("host") || "") !== HO_STAGING_HOSTNAME) throw new BoShellGateError(404, "Not found");
  const context = await authorizeBoShell(headers, env);
  const admitted = (env.HO_PILOT_FOUNDER_USER_IDS || "").split(",").map(id => id.trim()).filter(Boolean);
  if (!admitted.includes(context.userId)) throw new BoShellGateError(403, "Head Office access denied");
  let credential;
  try { credential = await teamCredentialFromHeaders(headers, env, "BO"); }
  catch (error) {
    if (error instanceof TeamAuthError) throw new BoShellGateError(error.status, "HO authorization denied");
    throw new BoShellGateError(503, "HO authorization unavailable");
  }
  let proof;
  try { proof = await callBoAccessCoreWithCredential(env.PINO_BO_CORE, {method:"GET",path:"ho/admission"}, credential); }
  catch { throw new BoShellGateError(503, "HO authorization unavailable"); }
  const provenFounder = (proof.body as {data?: {admitted?: unknown}} | null)?.data?.admitted === true;
  if (proof.status !== 200 || !provenFounder) {
    throw new BoShellGateError(proof.status === 401 ? 401 : proof.status === 403 || proof.status === 200 ? 403 : 503, "HO authorization denied");
  }
  // Individual HO data and media actions still require their explicit Core permissions.
  return context;
}
