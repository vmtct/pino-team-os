/** PAP-1646 / Epic PAP-650 PNR-TV — F1/F2 read-only Staff Viewer ingress.
 * The Viewer reference is a target, NEVER a credential or permission.
 * The policy reference requests a Center. Workforce confirms Staff membership, and Core authorizes the policy.
 * HO Founder selected-Center bridge and PAP-9/PAP-1921 ACL F3 remain separate.
 */
import { isStableTvPolicyRef } from "./pinoria-tv-viewer-link";
import { parsePublishedTvPolicyProjection, type ViewerPublishedProjection } from "./pinoria-tv-viewer-published";
import { callTosLearningCoreWithCredential, type TosLearningCoreBinding } from "./tos-learning-core";
import { callWorkforceCoreWithCredential, type WorkforceCoreBinding } from "./workforce-core";
import { teamCredential, TeamAuthError, type TeamAccessEnv } from "./team-auth";
import { TOS_STAGING_HOSTNAME } from "./host-boundary";

export interface StaffPolicyViewerEnv extends TeamAccessEnv {
  APP_ENV?: string;
  PINO_TOS_LEARNING_CORE?: TosLearningCoreBinding;
  PINO_WORKFORCE_CORE?: WorkforceCoreBinding;
}
export type StaffPolicyViewerResult =
  | Readonly<{ kind: "published"; policy: ViewerPublishedProjection }>
  | Readonly<{ kind: "blocked"; status: 401 | 403 | 404 | 503 }>;

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const object = (x: unknown): x is Record<string, unknown> =>
  x !== null && typeof x === "object" && !Array.isArray(x);
const blocked = (status: 401 | 403 | 404 | 503): StaffPolicyViewerResult => ({ kind: "blocked", status });
function statusOf(status: number): 401 | 403 | 404 | 503 {
  if (status === 401 || status === 403 || status === 404) return status;
  return 503;
}

/** Resolve only a requested Center present in authenticated Staff Workforce context. */
export function authorizedStaffViewerCenter(payload: unknown, requestedCenterId: string): string | null {
  if (!UUID_V7.test(requestedCenterId) || !object(payload) || !object(payload.data)) return null;
  const ctx = payload.data;
  if (typeof ctx.userId !== "string" || !ctx.userId.trim() ||
    typeof ctx.staffMemberId !== "string" || !ctx.staffMemberId.trim() ||
    ctx.founderMode === true || !Array.isArray(ctx.centers) ) return null;
  return ctx.centers.some(center => object(center) && center.id === requestedCenterId) ? requestedCenterId : null;
}


/** This can never produce a successful projection from Team input alone:
 * Workforce Core first authenticates Staff + membership in the requested Center,
 * then TosLearning Core independently validates surface, center and
 * pinoria.tv.published.view before returning the currently published Policy.
 */
export async function readStaffPublishedViewer(
  request: Request, env: StaffPolicyViewerEnv, policyRef: unknown,
): Promise<StaffPolicyViewerResult> {
  const url = new URL(request.url);
  if (env.APP_ENV !== "staging" ||
    url.protocol !== "https:" || url.hostname !== TOS_STAGING_HOSTNAME ||
    request.headers.get("host")?.toLowerCase() !== TOS_STAGING_HOSTNAME ||
    url.port || url.search || url.hash || request.method !== "GET" ||
    !isStableTvPolicyRef(policyRef) || url.pathname !== "/tv/p/" + policyRef) return blocked(404);

  // DEFAULT is Founder HO only, never a TOS Staff link.
  if (policyRef === "tvp1-default") return blocked(403);
  if (!env.PINO_WORKFORCE_CORE || !env.PINO_TOS_LEARNING_CORE) return blocked(503);

  try {
    const credential = await teamCredential(request, env, "TOS");
    // Do not inherit support-session/delegation privileges for this Viewer.
    if (credential.kind !== "password") return blocked(403);

    const context = await callWorkforceCoreWithCredential(
      env.PINO_WORKFORCE_CORE, { method: "GET", path: "/context", body: {} }, credential,
    );
    if (context.status !== 200) return blocked(statusOf(context.status));
    const centerId = authorizedStaffViewerCenter(context.body, policyRef.slice("tvp1-center-".length));
    if (!centerId) return blocked(403);

    const published = await callTosLearningCoreWithCredential(
      env.PINO_TOS_LEARNING_CORE,
      { method: "GET", path: "/pinoria/tv-policies/published", body: { centerId, policyRef } },
      credential,
    );
    if (published.status !== 200) return blocked(statusOf(published.status));
    const policy = parsePublishedTvPolicyProjection(
      published.body, { policyRef, centerId, surface: "TOS" },
    );
    return policy ? { kind: "published", policy } : blocked(503);
  } catch (error) {
    if (error instanceof TeamAuthError) return blocked(error.status === 401 ? 401 : 503);
    // Never expose Core transport exception, stale config or private payload.
    return blocked(503);
  }
}
