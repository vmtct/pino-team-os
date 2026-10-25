import { authorizeHoShell, type HoEnv } from "./ho-auth";
import { HO_STAGING_HOSTNAME } from "./host-boundary";
import { authorizeBoShell, BoShellGateError, type BoShellGateEnv } from "./bo-shell-gate";
import { BO_SKELETON_HOST, isBoStagingHost } from "./bo-skeleton-routing";
export { BO_SKELETON_HOST } from "./bo-skeleton-routing";
export interface BoSkeletonEnv extends BoShellGateEnv {
  HO_PILOT_FOUNDER_USER_IDS?: string;
  APP_ENV?: string;
  BO_UI_ONLY?: string;
  ASSETS: { fetch(request: Request): Promise<Response> };
}
export const BO_AUTHORITY_PREFIX = "/bo-authority-source/";
export const BO_AUTHORITY_STYLES = ["styles.css", "playground.css", "playground-v22.css", "playground-v23.css", "full-detail-v24.css", "full-detail-v25.css"] as const;
export const BO_AUTHORITY_ASSETS = new Set<string>(BO_AUTHORITY_STYLES);
export function boSkeletonEnabled(env: Pick<BoSkeletonEnv, "APP_ENV" | "BO_UI_ONLY">, host: string) {
  return env.APP_ENV === "staging" && env.BO_UI_ONLY === "enabled" && isBoStagingHost(host);
}
/** Historical controller path now serves ONLY the six authenticated DS stylesheets.
 * /bo is rendered by React; prototype HTML/JS and the monkey-patch bridge never execute. */
export async function serveBoSkeleton(request: Request, env: BoSkeletonEnv, asset: string): Promise<Response> {
  const url = new URL(request.url), headers = { "cache-control": "private, no-store", "x-content-type-options": "nosniff" };
  const ho = url.hostname === HO_STAGING_HOSTNAME && env.APP_ENV === "staging";
  if ((!ho && !boSkeletonEnabled(env, url.hostname)) || !BO_AUTHORITY_ASSETS.has(asset)) return new Response("Not Found", { status: 404, headers });
  try { if (ho) await authorizeHoShell(request.headers, env as HoEnv); else await authorizeBoShell(request.headers, env); }
  catch (error) {
    return new Response(error instanceof BoShellGateError ? "BO access denied" : "BO authorization unavailable", { status: error instanceof BoShellGateError ? error.status : 503, headers });
  }
  const response = await env.ASSETS.fetch(new Request(new URL(BO_AUTHORITY_PREFIX + asset, url.origin)));
  if (!response.ok) return new Response("Authority asset unavailable", { status: 503, headers });
  return new Response(response.body, { headers: { ...headers, "content-type": "text/css; charset=utf-8" } });
}
